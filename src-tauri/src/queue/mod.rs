use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandChild;

use crate::error::{AppError, AppResult};
use crate::types::{JobStatus, ProgressPayload};

pub type BoxedJobFuture = Pin<Box<dyn Future<Output = ()> + Send>>;
pub type JobRunner<J> = fn(AppHandle, Arc<JobQueue<J>>, J) -> BoxedJobFuture;

pub trait QueueItem: Clone + Serialize + Send + Sync + 'static {
    fn id(&self) -> &str;
    fn status(&self) -> &JobStatus;
    fn status_mut(&mut self) -> &mut JobStatus;
    fn created_at(&self) -> u64;
    fn set_progress(&mut self, progress: f32, speed: Option<String>);
    fn set_error(&mut self, error: Option<String>);
    fn reset_for_retry(&mut self);
    fn on_completed(&mut self) {}
}

pub struct QueueConfig {
    pub progress_event: &'static str,
    pub changed_event: &'static str,
    pub not_found_message: &'static str,
    pub retry_invalid_message: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CancelAction {
    CancelledQueued,
    KillRunning,
    AlreadyFinished,
}

/// Pure in-memory job queue state machine, decoupled from Tauri handles for unit testing.
pub struct QueueCore<J: QueueItem> {
    jobs: Mutex<HashMap<String, J>>,
    cancelled: Mutex<HashSet<String>>,
    max_concurrency: AtomicUsize,
    not_found_message: &'static str,
    retry_invalid_message: &'static str,
}

impl<J: QueueItem> QueueCore<J> {
    pub fn new(
        max_concurrency: usize,
        not_found_message: &'static str,
        retry_invalid_message: &'static str,
    ) -> Self {
        Self {
            jobs: Mutex::new(HashMap::new()),
            cancelled: Mutex::new(HashSet::new()),
            max_concurrency: AtomicUsize::new(max_concurrency.max(1)),
            not_found_message,
            retry_invalid_message,
        }
    }

    pub fn list(&self) -> Vec<J> {
        let mut jobs: Vec<J> = self.jobs.lock().values().cloned().collect();
        jobs.sort_by_key(|job| job.created_at());
        jobs
    }

    pub fn insert_batch(&self, items: Vec<J>) {
        let mut jobs = self.jobs.lock();
        for item in items {
            jobs.insert(item.id().to_string(), item);
        }
    }

    pub fn get(&self, id: &str) -> AppResult<J> {
        self.jobs
            .lock()
            .get(id)
            .cloned()
            .ok_or(AppError::NotFound(self.not_found_message))
    }

    pub fn update_item(&self, id: &str, f: impl FnOnce(&mut J)) {
        if let Some(job) = self.jobs.lock().get_mut(id) {
            f(job);
        }
    }

    pub fn cancel(&self, id: &str) -> AppResult<CancelAction> {
        self.cancelled.lock().insert(id.to_string());
        let status = {
            let jobs = self.jobs.lock();
            jobs.get(id).map(|job| job.status().clone())
        };
        match status {
            Some(JobStatus::Queued) => {
                self.complete(id, JobStatus::Cancelled, None);
                Ok(CancelAction::CancelledQueued)
            }
            Some(JobStatus::Running | JobStatus::Finalizing) => Ok(CancelAction::KillRunning),
            Some(_) => Ok(CancelAction::AlreadyFinished),
            None => Err(AppError::NotFound(self.not_found_message)),
        }
    }

    pub fn retry(&self, id: &str) -> AppResult<J> {
        {
            let mut jobs = self.jobs.lock();
            let job = jobs
                .get_mut(id)
                .ok_or(AppError::NotFound(self.not_found_message))?;
            if !matches!(job.status(), JobStatus::Failed | JobStatus::Cancelled) {
                return Err(AppError::validation(self.retry_invalid_message));
            }
            *job.status_mut() = JobStatus::Queued;
            job.reset_for_retry();
        }
        self.cancelled.lock().remove(id);
        self.get(id)
    }

    pub fn is_cancelled(&self, id: &str) -> bool {
        self.cancelled.lock().contains(id)
    }

    pub fn set_max_concurrency(&self, value: usize) {
        self.max_concurrency
            .store(value.clamp(1, 4), Ordering::Relaxed);
    }

    pub fn max_concurrency(&self) -> usize {
        self.max_concurrency.load(Ordering::Relaxed)
    }

    pub fn update_progress(&self, id: &str, progress: f32, speed: Option<String>) {
        if let Some(job) = self.jobs.lock().get_mut(id) {
            job.set_progress(progress, speed);
        }
    }

    pub fn complete(&self, id: &str, status: JobStatus, error: Option<String>) {
        if let Some(job) = self.jobs.lock().get_mut(id) {
            *job.status_mut() = status.clone();
            job.set_error(error);
            if status == JobStatus::Completed {
                job.on_completed();
            }
        }
    }

    pub fn take_next_pending(&self) -> Option<J> {
        let mut jobs = self.jobs.lock();
        let running = jobs
            .values()
            .filter(|job| matches!(job.status(), JobStatus::Running | JobStatus::Finalizing))
            .count();
        if running >= self.max_concurrency() {
            return None;
        }
        jobs.values_mut()
            .filter(|job| *job.status() == JobStatus::Queued)
            .min_by_key(|job| job.created_at())
            .map(|job| {
                *job.status_mut() = JobStatus::Running;
                job.clone()
            })
    }
}

/// Generic Tauri-backed job queue managing concurrency, child processes, and UI events.
pub struct JobQueue<J: QueueItem> {
    app: AppHandle,
    core: QueueCore<J>,
    children: Mutex<HashMap<String, CommandChild>>,
    config: QueueConfig,
    runner: JobRunner<J>,
}

impl<J: QueueItem> JobQueue<J> {
    pub fn new(
        app: AppHandle,
        max_concurrency: usize,
        config: QueueConfig,
        runner: JobRunner<J>,
    ) -> Arc<Self> {
        let core = QueueCore::new(
            max_concurrency,
            config.not_found_message,
            config.retry_invalid_message,
        );
        Arc::new(Self {
            app,
            core,
            children: Mutex::new(HashMap::new()),
            config,
            runner,
        })
    }

    pub fn list_jobs(&self) -> Vec<J> {
        self.core.list()
    }

    pub fn enqueue(self: &Arc<Self>, items: Vec<J>) {
        self.core.insert_batch(items);
        self.emit_jobs();
        self.spawn_pending();
    }

    pub fn cancel_job(&self, id: &str) -> AppResult<J> {
        match self.core.cancel(id)? {
            CancelAction::CancelledQueued => {
                self.take_child(id);
                self.emit_jobs();
            }
            CancelAction::KillRunning => self.kill_child(id),
            CancelAction::AlreadyFinished => {}
        }
        self.core.get(id)
    }

    pub fn retry_job(self: &Arc<Self>, id: &str) -> AppResult<J> {
        let job = self.core.retry(id)?;
        self.emit_jobs();
        self.spawn_pending();
        Ok(job)
    }

    pub fn set_max_concurrency(self: &Arc<Self>, value: usize) {
        self.core.set_max_concurrency(value);
        self.spawn_pending();
    }

    pub fn max_concurrency(&self) -> usize {
        self.core.max_concurrency()
    }

    pub fn is_cancelled(&self, id: &str) -> bool {
        self.core.is_cancelled(id)
    }

    pub fn store_child(&self, id: &str, child: CommandChild) {
        self.children.lock().insert(id.to_string(), child);
    }

    pub fn take_child(&self, id: &str) -> Option<CommandChild> {
        self.children.lock().remove(id)
    }

    pub fn kill_child(&self, id: &str) {
        if let Some(child) = self.take_child(id) {
            let _ = child.kill();
        }
    }

    pub fn update_job(&self, id: &str, f: impl FnOnce(&mut J)) {
        self.core.update_item(id, f);
    }

    pub fn set_status(&self, id: &str, status: JobStatus) {
        self.core.update_item(id, |job| {
            *job.status_mut() = status;
        });
        self.emit_jobs();
    }

    pub fn update_progress(&self, id: &str, progress: f32, speed: Option<String>) {
        self.core.update_progress(id, progress, speed.clone());
        let _ = self.app.emit(
            self.config.progress_event,
            ProgressPayload {
                id: id.to_string(),
                progress,
                speed,
            },
        );
        self.emit_jobs();
    }

    pub fn finish_job(self: &Arc<Self>, id: &str, status: JobStatus, error: Option<String>) {
        self.core.complete(id, status, error);
        self.take_child(id);
        self.emit_jobs();
        self.spawn_pending();
    }

    pub fn spawn_pending(self: &Arc<Self>) {
        while let Some(job) = self.core.take_next_pending() {
            self.emit_jobs();
            let app = self.app.clone();
            let queue = Arc::clone(self);
            let runner = self.runner;
            tauri::async_runtime::spawn(runner(app, queue, job));
        }
    }

    pub fn emit_jobs(&self) {
        let _ = self.app.emit(self.config.changed_event, self.list_jobs());
    }
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{CancelAction, QueueCore, QueueItem};
    use crate::types::JobStatus;

    #[derive(Clone, serde::Serialize)]
    struct TestJob {
        id: String,
        status: JobStatus,
        progress: f32,
        speed: Option<String>,
        error: Option<String>,
        created_at: u64,
    }

    impl QueueItem for TestJob {
        fn id(&self) -> &str {
            &self.id
        }
        fn status(&self) -> &JobStatus {
            &self.status
        }
        fn status_mut(&mut self) -> &mut JobStatus {
            &mut self.status
        }
        fn created_at(&self) -> u64 {
            self.created_at
        }
        fn set_progress(&mut self, progress: f32, speed: Option<String>) {
            self.progress = progress;
            self.speed = speed;
        }
        fn set_error(&mut self, error: Option<String>) {
            self.error = error;
        }
        fn reset_for_retry(&mut self) {
            self.progress = 0.0;
            self.speed = None;
            self.error = None;
        }
        fn on_completed(&mut self) {
            self.progress = 100.0;
        }
    }

    fn make_job(id: &str, created_at: u64) -> TestJob {
        TestJob {
            id: id.into(),
            status: JobStatus::Queued,
            progress: 0.0,
            speed: None,
            error: None,
            created_at,
        }
    }

    #[test]
    fn enqueue_respects_concurrency_and_order() {
        let queue = QueueCore::new(1, "not found", "cannot retry");
        queue.insert_batch(vec![make_job("b", 20), make_job("a", 10)]);

        let first = queue.take_next_pending().unwrap();
        assert_eq!(first.id, "a");
        assert_eq!(first.status, JobStatus::Running);
        assert!(queue.take_next_pending().is_none());

        queue.complete("a", JobStatus::Completed, None);
        assert_eq!(queue.get("a").unwrap().progress, 100.0);

        let second = queue.take_next_pending().unwrap();
        assert_eq!(second.id, "b");
    }

    #[test]
    fn cancel_queued_and_running_behaves_correctly() {
        let queue = QueueCore::new(2, "not found", "cannot retry");
        queue.insert_batch(vec![make_job("q", 10), make_job("r", 20)]);

        let running = queue.take_next_pending().unwrap();
        assert_eq!(running.id, "q");
        assert_eq!(queue.cancel("q").unwrap(), CancelAction::KillRunning);
        assert!(queue.is_cancelled("q"));

        assert_eq!(queue.cancel("r").unwrap(), CancelAction::CancelledQueued);
        assert_eq!(queue.get("r").unwrap().status, JobStatus::Cancelled);
        assert!(queue.cancel("missing").is_err());
    }

    #[test]
    fn retry_resets_failed_or_cancelled_jobs_only() {
        let queue = QueueCore::new(1, "not found", "cannot retry");
        queue.insert_batch(vec![make_job("j1", 10)]);

        assert!(queue.retry("j1").is_err());

        queue.update_progress("j1", 45.0, Some("2x".into()));
        queue.complete("j1", JobStatus::Failed, Some("boom".into()));

        let retried = queue.retry("j1").unwrap();
        assert_eq!(retried.status, JobStatus::Queued);
        assert_eq!(retried.progress, 0.0);
        assert!(retried.error.is_none());
        assert!(!queue.is_cancelled("j1"));
    }
}
