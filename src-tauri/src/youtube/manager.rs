use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandChild;
use uuid::Uuid;

use crate::types::{
    AddYoutubeDownloadRequest, JobStatus, ProgressPayload, YoutubeDownloadJob,
};
use crate::youtube::download::run_download;

pub struct YoutubeManager {
    app: AppHandle,
    jobs: Mutex<HashMap<String, YoutubeDownloadJob>>,
    children: Mutex<HashMap<String, CommandChild>>,
    cancelled: Mutex<HashSet<String>>,
}

impl YoutubeManager {
    pub fn new(app: AppHandle) -> Arc<Self> {
        Arc::new(Self {
            app,
            jobs: Mutex::new(HashMap::new()),
            children: Mutex::new(HashMap::new()),
            cancelled: Mutex::new(HashSet::new()),
        })
    }

    pub fn list_jobs(&self) -> Vec<YoutubeDownloadJob> {
        let mut jobs: Vec<YoutubeDownloadJob> =
            self.jobs.lock().unwrap().values().cloned().collect();
        jobs.sort_by_key(|job| job.created_at);
        jobs
    }

    pub fn add_job(
        self: &Arc<Self>,
        request: AddYoutubeDownloadRequest,
    ) -> Result<YoutubeDownloadJob, String> {
        if request.url.trim().is_empty() {
            return Err("Cole um link de vídeo".into());
        }
        if request.output_dir.trim().is_empty() {
            return Err("Escolha uma pasta para salvar o arquivo".into());
        }

        let id = Uuid::new_v4().to_string();
        let job = YoutubeDownloadJob {
            id: id.clone(),
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
        self.jobs.lock().unwrap().insert(id, job.clone());
        self.emit_jobs();
        self.spawn_pending();
        Ok(job)
    }

    pub fn cancel_job(&self, id: &str) -> Result<YoutubeDownloadJob, String> {
        self.cancelled.lock().unwrap().insert(id.to_string());
        let status = {
            let jobs = self.jobs.lock().unwrap();
            jobs.get(id).map(|job| job.status.clone())
        };
        match status {
            Some(JobStatus::Queued) => self.complete(id, JobStatus::Cancelled, None, None),
            Some(JobStatus::Running) => self.kill_child(id),
            Some(_) => {}
            None => return Err("Download não encontrado".into()),
        }
        self.job_by_id(id)
    }

    pub fn retry_job(self: &Arc<Self>, id: &str) -> Result<YoutubeDownloadJob, String> {
        {
            let mut jobs = self.jobs.lock().unwrap();
            let job = jobs.get_mut(id).ok_or("Download não encontrado")?;
            if !matches!(job.status, JobStatus::Failed | JobStatus::Cancelled) {
                return Err("Só é possível repetir downloads falhos ou cancelados".into());
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

    pub fn update_progress(&self, id: &str, progress: f32, speed: Option<String>) {
        {
            let mut jobs = self.jobs.lock().unwrap();
            if let Some(job) = jobs.get_mut(id) {
                job.progress = progress;
                job.speed = speed.clone();
            }
        }
        let _ = self.app.emit(
            "yt-job-progress",
            ProgressPayload {
                id: id.to_string(),
                progress,
                speed,
            },
        );
        self.emit_jobs();
    }

    pub fn mark_cancelled(self: &Arc<Self>, id: &str) {
        self.finish_job(id, JobStatus::Cancelled, None, None);
    }

    pub fn finish_job(
        self: &Arc<Self>,
        id: &str,
        status: JobStatus,
        error: Option<String>,
        output_path: Option<String>,
    ) {
        self.complete(id, status, error, output_path);
        self.spawn_pending();
    }

    fn complete(
        &self,
        id: &str,
        status: JobStatus,
        error: Option<String>,
        output_path: Option<String>,
    ) {
        {
            let mut jobs = self.jobs.lock().unwrap();
            if let Some(job) = jobs.get_mut(id) {
                job.status = status.clone();
                job.error = error;
                if let Some(path) = output_path {
                    job.output_path = Some(path);
                }
                if status == JobStatus::Completed {
                    job.progress = 100.0;
                    job.speed = None;
                }
            }
        }
        self.take_child(id);
        self.emit_jobs();
    }

    pub fn spawn_pending(self: &Arc<Self>) {
        let next = {
            let mut jobs = self.jobs.lock().unwrap();
            let running = jobs
                .values()
                .filter(|job| job.status == JobStatus::Running)
                .count();
            if running >= 1 {
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

        if let Some(job) = next {
            self.emit_jobs();
            let app = self.app.clone();
            let manager = Arc::clone(self);
            tauri::async_runtime::spawn(async move {
                run_download(app, manager, job).await;
            });
        }
    }

    fn job_by_id(&self, id: &str) -> Result<YoutubeDownloadJob, String> {
        self.jobs
            .lock()
            .unwrap()
            .get(id)
            .cloned()
            .ok_or_else(|| "Download não encontrado".into())
    }

    fn emit_jobs(&self) {
        let _ = self.app.emit("yt-jobs-changed", self.list_jobs());
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
