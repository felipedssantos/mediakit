use std::sync::Arc;

use parking_lot::Mutex;
use tauri::AppHandle;

use crate::presets::build_args;
use crate::probe;
use crate::progress::{parse_ffmpeg_progress, parse_ffmpeg_speed};
use crate::queue::JobQueue;
use crate::sidecar::{run_output, spawn_sidecar, stream_lines, StreamSource};
use crate::types::{GpuVendor, HwCapabilities, Job, JobStatus};

static HW_CACHE: Mutex<Option<HwCapabilities>> = Mutex::new(None);

/// Clears cached hardware encoder capabilities so they are re-probed after sidecar changes.
pub fn invalidate_hw_cache() {
    *HW_CACHE.lock() = None;
}

/// Executes an FFmpeg conversion job, streaming progress and handling cancellation.
pub async fn run_job(app: AppHandle, queue: Arc<JobQueue<Job>>, mut job: Job) {
    if queue.is_cancelled(&job.id) {
        queue.finish_job(&job.id, JobStatus::Cancelled, None);
        return;
    }

    let media = match probe::probe_media(&app, &job.input_path).await {
        Ok(info) => info,
        Err(err) => {
            queue.finish_job(&job.id, JobStatus::Failed, Some(err.to_string()));
            return;
        }
    };
    job.duration = media.duration;
    queue.update_job(&job.id, |item| item.duration = media.duration);
    let still_image = media.duration <= 0.05;

    let hw = detect_hw_capabilities(&app).await;
    let args = match build_args(
        &job.input_path,
        &job.output_path,
        &job.options,
        Some(&media),
        hw.gpu,
    ) {
        Ok(args) => args,
        Err(err) => {
            queue.finish_job(&job.id, JobStatus::Failed, Some(err.to_string()));
            return;
        }
    };

    let (mut rx, child) = match spawn_sidecar(&app, "ffmpeg", args) {
        Ok(pair) => pair,
        Err(err) => {
            queue.finish_job(&job.id, JobStatus::Failed, Some(err.to_string()));
            return;
        }
    };

    queue.store_child(&job.id, child);
    if still_image {
        queue.update_progress(&job.id, 20.0, None);
    }

    let mut last_speed: Option<String> = None;
    let outcome = match stream_lines(
        &mut rx,
        false,
        false,
        || queue.is_cancelled(&job.id),
        || queue.kill_child(&job.id),
        |source, line| {
            if let Some(speed) = parse_ffmpeg_speed(line) {
                last_speed = Some(speed);
            }
            if source == StreamSource::Stdout {
                if let Some(progress) = parse_ffmpeg_progress(line, job.duration) {
                    queue.update_progress(&job.id, progress, last_speed.clone());
                }
            }
        },
    )
    .await
    {
        Ok(outcome) => outcome,
        Err(err) => {
            queue.finish_job(&job.id, JobStatus::Failed, Some(err.to_string()));
            return;
        }
    };

    queue.take_child(&job.id);

    if outcome.cancelled || queue.is_cancelled(&job.id) {
        queue.finish_job(&job.id, JobStatus::Cancelled, None);
        return;
    }

    if outcome.exit_code.unwrap_or(-1) == 0 {
        queue.update_progress(&job.id, 100.0, last_speed);
        queue.finish_job(&job.id, JobStatus::Completed, None);
    } else {
        let code = outcome.exit_code.unwrap_or(-1);
        let detail = outcome.tail.join("\n");
        let message = if detail.trim().is_empty() {
            format!("FFmpeg encerrou com código {code}")
        } else {
            format!("FFmpeg encerrou com código {code}: {detail}")
        };
        queue.finish_job(&job.id, JobStatus::Failed, Some(message));
    }
}

async fn probe_encoder(app: &AppHandle, vendor: GpuVendor, encoder: &str) -> bool {
    let mut args = vec!["-hide_banner".into(), "-loglevel".into(), "error".into()];
    if vendor == GpuVendor::Vaapi {
        args.extend(["-vaapi_device".into(), "/dev/dri/renderD128".into()]);
    }
    args.extend([
        "-f".into(),
        "lavfi".into(),
        "-i".into(),
        "color=c=black:s=256x256:d=0.04".into(),
    ]);
    if vendor == GpuVendor::Vaapi {
        args.extend(["-vf".into(), "format=nv12,hwupload".into()]);
    }
    args.extend([
        "-frames:v".into(),
        "1".into(),
        "-c:v".into(),
        encoder.into(),
        "-f".into(),
        "null".into(),
        "-".into(),
    ]);
    match run_output(app, "ffmpeg", &args).await {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

/// Detects available hardware video encoders by probing each candidate with a 1-frame null encode.
pub async fn detect_hw_capabilities(app: &AppHandle) -> HwCapabilities {
    if let Some(cached) = HW_CACHE.lock().clone() {
        return cached;
    }

    let encoder_args = vec!["-hide_banner".into(), "-encoders".into()];
    let encoders_out = match run_output(app, "ffmpeg", &encoder_args).await {
        Ok(out) => String::from_utf8_lossy(&out.stdout).into_owned(),
        Err(_) => String::new(),
    };

    let candidates: &[(GpuVendor, &str)] = &[
        (GpuVendor::Nvidia, "h264_nvenc"),
        (GpuVendor::Amd, "h264_amf"),
        (GpuVendor::Intel, "h264_qsv"),
        #[cfg(target_os = "macos")]
        (GpuVendor::Apple, "h264_videotoolbox"),
        #[cfg(target_os = "linux")]
        (GpuVendor::Vaapi, "h264_vaapi"),
    ];

    let mut handles = Vec::new();
    for &(vendor, encoder) in candidates {
        if encoders_out.contains(encoder) {
            let app_clone = app.clone();
            handles.push(tauri::async_runtime::spawn(async move {
                if probe_encoder(&app_clone, vendor, encoder).await {
                    Some(vendor)
                } else {
                    None
                }
            }));
        }
    }

    let mut available_gpus = Vec::new();
    for handle in handles {
        if let Ok(Some(vendor)) = handle.await {
            available_gpus.push(vendor);
        }
    }

    let caps = HwCapabilities {
        nvenc: available_gpus.contains(&GpuVendor::Nvidia),
        gpu: available_gpus.first().copied(),
        available_gpus,
    };
    *HW_CACHE.lock() = Some(caps.clone());
    caps
}
