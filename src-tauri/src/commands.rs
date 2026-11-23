use std::sync::Arc;

use tauri::{AppHandle, Manager, State};

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
pub async fn probe_media(app: AppHandle, path: String) -> Result<MediaInfo, String> {
    media_probe::probe_media(&app, &path).await
}

#[tauri::command]
pub async fn add_job(
    manager: State<'_, Arc<JobManager>>,
    input_path: String,
    output_path: Option<String>,
    output_dir: Option<String>,
    options: EncodeOptions,
) -> Result<Job, String> {
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
        .ok_or_else(|| "Falha ao criar job".into())
}

#[tauri::command]
pub async fn add_jobs(
    manager: State<'_, Arc<JobManager>>,
    items: Vec<AddJobRequest>,
) -> Result<Vec<Job>, String> {
    manager.add_jobs(items)
}

#[tauri::command]
pub async fn cancel_job(manager: State<'_, Arc<JobManager>>, id: String) -> Result<Job, String> {
    manager.cancel_job(&id)
}

#[tauri::command]
pub async fn retry_job(manager: State<'_, Arc<JobManager>>, id: String) -> Result<Job, String> {
    manager.retry_job(&id)
}

#[tauri::command]
pub async fn get_jobs(manager: State<'_, Arc<JobManager>>) -> Result<Vec<Job>, String> {
    Ok(manager.list_jobs())
}

#[tauri::command]
pub async fn set_max_concurrency(
    manager: State<'_, Arc<JobManager>>,
    value: u32,
) -> Result<u32, String> {
    manager.set_max_concurrency(value as usize);
    Ok(manager.max_concurrency() as u32)
}

#[tauri::command]
pub async fn get_max_concurrency(manager: State<'_, Arc<JobManager>>) -> Result<u32, String> {
    Ok(manager.max_concurrency() as u32)
}

#[tauri::command]
pub async fn detect_hw(app: AppHandle) -> Result<HwCapabilities, String> {
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
) -> Result<String, String> {
    Ok(default_output_path(
        &input_path,
        &preset_id,
        output_dir.as_deref(),
        image_format.as_deref(),
    ))
}

#[tauri::command]
pub async fn probe_youtube(app: AppHandle, url: String) -> Result<YoutubeVideo, String> {
    youtube_probe::probe_url(&app, &url).await
}

#[tauri::command]
pub async fn add_youtube_download(
    manager: State<'_, Arc<YoutubeManager>>,
    url: String,
    title: String,
    output_dir: String,
    options: YoutubeDownloadOptions,
) -> Result<YoutubeDownloadJob, String> {
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Não foi possível criar a pasta de destino: {e}"))?;
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
) -> Result<YoutubeDownloadJob, String> {
    manager.cancel_job(&id)
}

#[tauri::command]
pub async fn retry_youtube_download(
    manager: State<'_, Arc<YoutubeManager>>,
    id: String,
) -> Result<YoutubeDownloadJob, String> {
    manager.retry_job(&id)
}

#[tauri::command]
pub async fn get_youtube_downloads(
    manager: State<'_, Arc<YoutubeManager>>,
) -> Result<Vec<YoutubeDownloadJob>, String> {
    Ok(manager.list_jobs())
}

#[tauri::command]
pub async fn default_download_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .video_dir()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|e| format!("Pasta de vídeos não encontrada: {e}"))
}
