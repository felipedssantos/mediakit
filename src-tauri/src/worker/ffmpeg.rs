use std::sync::Arc;

use tauri::AppHandle;

use crate::error::AppResult;
use crate::presets::build_args;
use crate::probe;
use crate::progress::{parse_ffmpeg_progress, parse_ffmpeg_speed};
use crate::queue::JobQueue;
use crate::sidecar::{run_output, spawn_sidecar, stream_lines, StreamSource};
use crate::types::{Job, JobStatus};

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

    let args = match build_args(
        &job.input_path,
        &job.output_path,
        &job.options,
        Some(&media),
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

pub async fn detect_nvenc(app: &AppHandle) -> AppResult<bool> {
    let args = vec!["-hide_banner".into(), "-encoders".into()];
    let output = run_output(app, "ffmpeg", &args).await?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.contains("h264_nvenc") || stdout.contains("hevc_nvenc"))
}
