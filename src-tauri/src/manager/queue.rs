use std::sync::Arc;

use tauri::AppHandle;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::queue::{now_secs, BoxedJobFuture, JobQueue, QueueConfig, QueueItem};
use crate::types::{AddJobRequest, Job, JobStatus};
use crate::worker::ffmpeg::run_job;

fn spawn_job(app: AppHandle, queue: Arc<JobQueue<Job>>, job: Job) -> BoxedJobFuture {
    Box::pin(run_job(app, queue, job))
}

impl QueueItem for Job {
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

pub struct JobManager {
    queue: Arc<JobQueue<Job>>,
}

impl JobManager {
    pub fn new(app: AppHandle) -> Arc<Self> {
        let queue = JobQueue::new(
            app,
            1,
            QueueConfig {
                progress_event: "job-progress",
                changed_event: "jobs-changed",
                not_found_message: "Job não encontrado",
                retry_invalid_message: "Só é possível repetir jobs falhos ou cancelados",
            },
            spawn_job,
        );
        Arc::new(Self { queue })
    }

    pub fn list_jobs(&self) -> Vec<Job> {
        self.queue.list_jobs()
    }

    pub fn add_jobs(&self, requests: Vec<AddJobRequest>) -> AppResult<Vec<Job>> {
        let created_at = now_secs();
        let mut created = Vec::with_capacity(requests.len());
        for request in requests {
            if request.input_path.trim().is_empty() {
                return Err(AppError::validation("Caminho de entrada vazio"));
            }
            if request.output_path.trim().is_empty() {
                return Err(AppError::validation("Caminho de saída vazio"));
            }
            created.push(Job {
                id: Uuid::new_v4().to_string(),
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
            });
        }
        self.queue.enqueue(created.clone());
        Ok(created)
    }

    pub fn cancel_job(&self, id: &str) -> AppResult<Job> {
        self.queue.cancel_job(id)
    }

    pub fn retry_job(&self, id: &str) -> AppResult<Job> {
        self.queue.retry_job(id)
    }

    pub fn set_max_concurrency(&self, value: usize) {
        self.queue.set_max_concurrency(value);
    }

    pub fn max_concurrency(&self) -> usize {
        self.queue.max_concurrency()
    }
}
