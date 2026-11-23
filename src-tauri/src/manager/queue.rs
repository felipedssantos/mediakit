use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandChild;
use uuid::Uuid;

use crate::types::{AddJobRequest, Job, JobStatus, ProgressPayload};
use crate::worker::ffmpeg::run_job;

pub struct JobManager {
    app: AppHandle,
    jobs: Mutex<HashMap<String, Job>>,
    children: Mutex<HashMap<String, CommandChild>>,
    cancelled: Mutex<HashSet<String>>,
    max_concurrency: AtomicUsize,
}

impl JobManager {
    pub fn new(app: AppHandle) -> Arc<Self> {
        Arc::new(Self {
            app,
            jobs: Mutex::new(HashMap::new()),
            children: Mutex::new(HashMap::new()),
            cancelled: Mutex::new(HashSet::new()),
            max_concurrency: AtomicUsize::new(1),
        })
    }

    pub fn list_jobs(&self) -> Vec<Job> {
        let mut jobs: Vec<Job> = self.jobs.lock().unwrap().values().cloned().collect();
        jobs.sort_by_key(|job| job.created_at);
        jobs
    }

    pub fn add_jobs(self: &Arc<Self>, requests: Vec<AddJobRequest>) -> Result<Vec<Job>, String> {
        let created_at = now_secs();
        let mut created = Vec::new();
        {
            let mut jobs = self.jobs.lock().unwrap();
            for request in requests {
                if request.input_path.trim().is_empty() {
                    return Err("Caminho de entrada vazio".into());
                }
                if request.output_path.trim().is_empty() {
                    return Err("Caminho de saída vazio".into());
                }
                let id = Uuid::new_v4().to_string();
                let job = Job {
                    id: id.clone(),
                    input_path: request.input_path,
                    output_path: request.output_path,
                    preset_id: request.options.preset_id.clone(),
                    options: request.options,
                    status: JobStatus::Queued,
                    progress: 0.0,
                    speed: None,
                    error: None,
                    duration: 0.0,
                    created_at,
                };
                jobs.insert(id, job.clone());
                created.push(job);
            }
        }
        self.emit_jobs();
        self.spawn_pending();
        Ok(created)
    }

    pub fn cancel_job(&self, id: &str) -> Result<Job, String> {
        self.cancelled.lock().unwrap().insert(id.to_string());
        let status = {
            let jobs = self.jobs.lock().unwrap();
            jobs.get(id).map(|job| job.status.clone())
        };
        match status {
            Some(JobStatus::Queued) => self.complete(id, JobStatus::Cancelled, None),
            Some(JobStatus::Running) => self.kill_child(id),
            Some(_) => {}
            None => return Err("Job não encontrado".into()),
        }
        self.job_by_id(id)
    }

    pub fn retry_job(self: &Arc<Self>, id: &str) -> Result<Job, String> {
        {
            let mut jobs = self.jobs.lock().unwrap();
            let job = jobs.get_mut(id).ok_or("Job não encontrado")?;
            if !matches!(job.status, JobStatus::Failed | JobStatus::Cancelled) {
                return Err("Só é possível repetir jobs falhos ou cancelados".into());
            }
            job.status = JobStatus::Queued;
            job.progress = 0.0;
            job.speed = None;
            job.error = None;
        }
        self.cancelled.lock().unwrap().remove(id);
        self.emit_jobs();
        self.spawn_pending();
        self.job_by_id(id)
    }

    pub fn set_max_concurrency(self: &Arc<Self>, value: usize) {
        let clamped = value.clamp(1, 4);
        self.max_concurrency.store(clamped, Ordering::Relaxed);
        self.spawn_pending();
    }

    pub fn max_concurrency(&self) -> usize {
        self.max_concurrency.load(Ordering::Relaxed)
    }

    pub fn is_cancelled(&self, id: &str) -> bool {
        self.cancelled.lock().unwrap().contains(id)
    }

    pub fn store_child(&self, id: &str, child: CommandChild) {
        self.children.lock().unwrap().insert(id.to_string(), child);
    }

    pub fn take_child(&self, id: &str) -> Option<CommandChild> {
        self.children.lock().unwrap().remove(id)
    }

    pub fn kill_child(&self, id: &str) {
        if let Some(child) = self.take_child(id) {
            let _ = child.kill();
        }
    }

    pub fn update_duration(&self, id: &str, duration: f64) {
        if let Some(job) = self.jobs.lock().unwrap().get_mut(id) {
            job.duration = duration;
        }
    }

    pub fn update_progress(&self, id: &str, progress: f32, speed: Option<String>) {
        {
            let mut jobs = self.jobs.lock().unwrap();
            if let Some(job) = jobs.get_mut(id) {
                job.progress = progress;
                job.speed = speed.clone();
            }
        }
        let _ = self.app.emit(
            "job-progress",
            ProgressPayload {
                id: id.to_string(),
                progress,
                speed,
            },
        );
        self.emit_jobs();
    }

    pub fn mark_cancelled(self: &Arc<Self>, id: &str) {
        self.finish_job(id, JobStatus::Cancelled, None);
    }

    pub fn finish_job(self: &Arc<Self>, id: &str, status: JobStatus, error: Option<String>) {
        self.complete(id, status, error);
        self.spawn_pending();
    }

    fn complete(&self, id: &str, status: JobStatus, error: Option<String>) {
        {
            let mut jobs = self.jobs.lock().unwrap();
            if let Some(job) = jobs.get_mut(id) {
                job.status = status.clone();
                job.error = error;
                if status == JobStatus::Completed {
                    job.progress = 100.0;
                }
            }
        }
        self.take_child(id);
        self.emit_jobs();
    }

    pub fn spawn_pending(self: &Arc<Self>) {
        loop {
            let next = {
                let mut jobs = self.jobs.lock().unwrap();
                let running = jobs
                    .values()
                    .filter(|job| job.status == JobStatus::Running)
                    .count();
                if running >= self.max_concurrency() {
                    None
                } else {
                    jobs.values_mut()
                        .filter(|job| job.status == JobStatus::Queued)
                        .min_by_key(|job| job.created_at)
                        .map(|job| {
                            job.status = JobStatus::Running;
                            job.clone()
                        })
                }
            };

            match next {
                Some(job) => {
                    self.emit_jobs();
                    let app = self.app.clone();
                    let manager = Arc::clone(self);
                    tauri::async_runtime::spawn(async move {
                        run_job(app, manager, job).await;
                    });
                }
                None => break,
            }
        }
    }

    fn job_by_id(&self, id: &str) -> Result<Job, String> {
        self.jobs
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .ok_or_else(|| "Job não encontrado".into())
    }

    fn emit_jobs(&self) {
        let _ = self.app.emit("jobs-changed", self.list_jobs());
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
