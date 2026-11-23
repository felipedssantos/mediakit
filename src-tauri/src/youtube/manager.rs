use std::sync::Arc;

use tauri::AppHandle;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::queue::{now_secs, BoxedJobFuture, JobQueue, QueueConfig, QueueItem};
use crate::types::{AddYoutubeDownloadRequest, JobStatus, YoutubeDownloadJob};
use crate::youtube::download::run_download;

fn spawn_download(
    app: AppHandle,
    queue: Arc<JobQueue<YoutubeDownloadJob>>,
    job: YoutubeDownloadJob,
) -> BoxedJobFuture {
    Box::pin(run_download(app, queue, job))
}

impl QueueItem for YoutubeDownloadJob {
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
        self.speed = None;
    }
}

pub struct YoutubeManager {
    queue: Arc<JobQueue<YoutubeDownloadJob>>,
}

impl YoutubeManager {
    pub fn new(app: AppHandle) -> Arc<Self> {
        let queue = JobQueue::new(
            app,
            1,
            QueueConfig {
                progress_event: "yt-job-progress",
                changed_event: "yt-jobs-changed",
                not_found_message: "Download não encontrado",
                retry_invalid_message: "Só é possível repetir downloads falhos ou cancelados",
            },
            spawn_download,
        );
        Arc::new(Self { queue })
    }

    pub fn list_jobs(&self) -> Vec<YoutubeDownloadJob> {
        self.queue.list_jobs()
    }

    pub fn add_job(&self, request: AddYoutubeDownloadRequest) -> AppResult<YoutubeDownloadJob> {
        if request.url.trim().is_empty() {
            return Err(AppError::validation("Cole um link de vídeo"));
        }
        if request.output_dir.trim().is_empty() {
            return Err(AppError::validation(
                "Escolha uma pasta para salvar o arquivo",
            ));
        }

        let job = YoutubeDownloadJob {
            id: Uuid::new_v4().to_string(),
            url: request.url,
            title: if request.title.trim().is_empty() {
                "Vídeo".into()
            } else {
                request.title
            },
            output_dir: request.output_dir,
            output_path: None,
            options: request.options,
            status: JobStatus::Queued,
            progress: 0.0,
            speed: None,
            error: None,
            created_at: now_secs(),
        };
        self.queue.enqueue(vec![job.clone()]);
        Ok(job)
    }

    pub fn cancel_job(&self, id: &str) -> AppResult<YoutubeDownloadJob> {
        self.queue.cancel_job(id)
    }

    pub fn retry_job(&self, id: &str) -> AppResult<YoutubeDownloadJob> {
        self.queue.retry_job(id)
    }
}
