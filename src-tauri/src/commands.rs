use std::sync::Arc;

use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};
use crate::manager::JobManager;
use crate::presets::default_output_path;
use crate::probe as media_probe;
use crate::types::{
    AddJobRequest, AddYoutubeDownloadRequest, EncodeOptions, HwCapabilities, Job, MediaInfo,
    YoutubeDownloadJob, YoutubeDownloadOptions, YoutubeVideo,
};
use crate::worker::ffmpeg::detect_nvenc;
use crate::youtube::probe as youtube_probe;
use crate::youtube::YoutubeManager;

#[tauri::command]
pub async fn probe_media(app: AppHandle, path: String) -> AppResult<MediaInfo> {
    media_probe::probe_media(&app, &path).await
}

#[tauri::command]
pub async fn add_job(
    manager: State<'_, Arc<JobManager>>,
    input_path: String,
    output_path: Option<String>,
    output_dir: Option<String>,
    options: EncodeOptions,
) -> AppResult<Job> {
    let output = output_path.unwrap_or_else(|| {
        default_output_path(
            &input_path,
            &options.preset_id,
            output_dir.as_deref(),
            options
                .container
                .as_deref()
                .or(options.image_format.as_deref()),
        )
    });
    let jobs = manager.add_jobs(vec![AddJobRequest {
        input_path,
        output_path: output,
        options,
    }])?;
    jobs.into_iter()
        .next()
        .ok_or_else(|| AppError::message("Falha ao criar job"))
}

#[tauri::command]
pub async fn add_jobs(
    manager: State<'_, Arc<JobManager>>,
    items: Vec<AddJobRequest>,
) -> AppResult<Vec<Job>> {
    manager.add_jobs(items)
}

#[tauri::command]
pub async fn cancel_job(manager: State<'_, Arc<JobManager>>, id: String) -> AppResult<Job> {
    manager.cancel_job(&id)
}

#[tauri::command]
pub async fn retry_job(manager: State<'_, Arc<JobManager>>, id: String) -> AppResult<Job> {
    manager.retry_job(&id)
}

#[tauri::command]
pub async fn get_jobs(manager: State<'_, Arc<JobManager>>) -> AppResult<Vec<Job>> {
    Ok(manager.list_jobs())
}

#[tauri::command]
pub async fn set_max_concurrency(
    manager: State<'_, Arc<JobManager>>,
    value: u32,
) -> AppResult<u32> {
    manager.set_max_concurrency(value as usize);
    Ok(manager.max_concurrency() as u32)
}

#[tauri::command]
pub async fn get_max_concurrency(manager: State<'_, Arc<JobManager>>) -> AppResult<u32> {
    Ok(manager.max_concurrency() as u32)
}

#[tauri::command]
pub async fn detect_hw(app: AppHandle) -> AppResult<HwCapabilities> {
    Ok(HwCapabilities {
        nvenc: detect_nvenc(&app).await.unwrap_or(false),
    })
}

#[tauri::command]
pub async fn suggest_output_path(
    input_path: String,
    preset_id: String,
    output_dir: Option<String>,
    image_format: Option<String>,
) -> AppResult<String> {
    Ok(default_output_path(
        &input_path,
        &preset_id,
        output_dir.as_deref(),
        image_format.as_deref(),
    ))
}

#[tauri::command]
pub async fn probe_youtube(app: AppHandle, url: String) -> AppResult<YoutubeVideo> {
    youtube_probe::probe_url(&app, &url).await
}

#[tauri::command]
pub async fn add_youtube_download(
    manager: State<'_, Arc<YoutubeManager>>,
    url: String,
    title: String,
    output_dir: String,
    options: YoutubeDownloadOptions,
) -> AppResult<YoutubeDownloadJob> {
    std::fs::create_dir_all(&output_dir).map_err(|e| {
        AppError::message(format!("Não foi possível criar a pasta de destino: {e}"))
    })?;
    manager.add_job(AddYoutubeDownloadRequest {
        url,
        title,
        output_dir,
        options,
    })
}

#[tauri::command]
pub async fn cancel_youtube_download(
    manager: State<'_, Arc<YoutubeManager>>,
    id: String,
) -> AppResult<YoutubeDownloadJob> {
    manager.cancel_job(&id)
}

#[tauri::command]
pub async fn retry_youtube_download(
    manager: State<'_, Arc<YoutubeManager>>,
    id: String,
) -> AppResult<YoutubeDownloadJob> {
    manager.retry_job(&id)
}

#[tauri::command]
pub async fn get_youtube_downloads(
    manager: State<'_, Arc<YoutubeManager>>,
) -> AppResult<Vec<YoutubeDownloadJob>> {
    Ok(manager.list_jobs())
}

#[tauri::command]
pub async fn default_download_dir(app: AppHandle) -> AppResult<String> {
    app.path()
        .video_dir()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|e| AppError::message(format!("Pasta de vídeos não encontrada: {e}")))
}
