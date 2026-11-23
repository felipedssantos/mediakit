use std::path::Path;
use std::sync::Arc;

use tauri::{AppHandle, Manager};

use crate::progress::{
    is_ytdlp_postprocess_line, overall_ytdlp_progress, parse_ytdlp_destination,
    parse_ytdlp_progress, parse_ytdlp_speed,
};
use crate::queue::JobQueue;
use crate::sidecar::{resolve_sidecar_path, spawn_sidecar, stream_lines};
use crate::types::{JobStatus, YoutubeDownloadJob};
use crate::youtube::cookies::CookieCache;
use crate::youtube::probe::humanize_ytdlp_error;

/// Executes a `yt-dlp` download job, streaming progress, post-processing state, and cancellation.
pub async fn run_download(
    app: AppHandle,
    queue: Arc<JobQueue<YoutubeDownloadJob>>,
    job: YoutubeDownloadJob,
) {
    if queue.is_cancelled(&job.id) {
        queue.finish_job(&job.id, JobStatus::Cancelled, None);
        return;
    }

    let ffmpeg = resolve_sidecar_path(&app, "ffmpeg");
    let stem = sanitize_filename(&job.title);
    let ext = if job.options.mode == "audio" {
        job.options.audio_format.as_str()
    } else {
        "mp4"
    };
    let output_template = Path::new(&job.output_dir)
        .join(format!("{stem}.%(ext)s"))
        .to_string_lossy()
        .into_owned();
    let expected_path = Path::new(&job.output_dir)
        .join(format!("{stem}.{ext}"))
        .to_string_lossy()
        .into_owned();

    let mut args = vec![
        "--no-warnings".into(),
        "--no-playlist".into(),
        "--newline".into(),
        "--progress".into(),
        "--windows-filenames".into(),
        "--no-mtime".into(),
        "--retries".into(),
        "3".into(),
        "--concurrent-fragments".into(),
        "4".into(),
        "--ffmpeg-location".into(),
        ffmpeg.to_string_lossy().into_owned(),
        "-o".into(),
        output_template,
    ];

    if job.options.mode == "audio" {
        args.extend([
            "-x".into(),
            "--audio-format".into(),
            job.options.audio_format.clone(),
            "--audio-quality".into(),
            "0".into(),
        ]);
    } else {
        args.extend([
            "-f".into(),
            format_selector(&job.options.quality),
            "-S".into(),
            "res,ext:mp4:m4a".into(),
            "--merge-output-format".into(),
            "mp4".into(),
        ]);
    }

    if let Some(browser) = app.state::<CookieCache>().preferred() {
        args.push("--cookies-from-browser".into());
        args.push(browser);
    }

    args.push("--".into());
    args.push(job.url.trim().to_string());

    let (mut rx, child) = match spawn_sidecar(&app, "yt-dlp", args) {
        Ok(pair) => pair,
        Err(err) => {
            queue.finish_job(&job.id, JobStatus::Failed, Some(err.to_string()));
            return;
        }
    };

    queue.store_child(&job.id, child);

    let mut last_speed: Option<String> = None;
    let mut last_progress: f32 = 0.0;
    let mut output_path = expected_path.clone();
    let mut part: u32 = 0;
    let expected_parts: u32 = if job.options.mode == "audio" { 1 } else { 2 };
    let mut finalizing = false;

    let outcome = match stream_lines(
        &mut rx,
        true,
        true,
        || queue.is_cancelled(&job.id),
        || queue.kill_child(&job.id),
        |_source, line| {
            if let Some(path) = parse_ytdlp_destination(line) {
                output_path = path;
                part = part.saturating_add(1);
            }
            if is_ytdlp_postprocess_line(line) {
                last_progress = last_progress.max(99.5);
                last_speed = None;
                if !finalizing {
                    finalizing = true;
                    queue.set_status(&job.id, JobStatus::Finalizing);
                }
                queue.update_progress(&job.id, last_progress, None);
            }
            if let Some(speed) = parse_ytdlp_speed(line) {
                last_speed = Some(speed);
            }
            if let Some(part_progress) = parse_ytdlp_progress(line) {
                let overall = overall_ytdlp_progress(part, expected_parts, part_progress);
                if overall + 0.2 >= last_progress {
                    last_progress = overall;
                    queue.update_progress(&job.id, overall, last_speed.clone());
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

    let file_ready = Path::new(&output_path).is_file() || Path::new(&expected_path).is_file();
    let resolved_path = if Path::new(&output_path).is_file() {
        output_path
    } else {
        expected_path
    };

    if outcome.exit_code.unwrap_or(0) == 0 || file_ready {
        queue.update_job(&job.id, |item| item.output_path = Some(resolved_path));
        queue.update_progress(&job.id, 100.0, last_speed);
        queue.finish_job(&job.id, JobStatus::Completed, None);
    } else {
        let detail = outcome.tail.join("\n");
        queue.finish_job(
            &job.id,
            JobStatus::Failed,
            Some(humanize_ytdlp_error(&detail)),
        );
    }
}

fn format_selector(quality: &str) -> String {
    // Prefers MP4 + M4A for fast remuxing, falling back to the site's best stream
    // when H.264/MP4 is unavailable (HLS, WebM, etc.).
    match quality {
        "1080p" => {
            "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b[height<=1080]/b"
                .into()
        }
        "720p" => {
            "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/b"
                .into()
        }
        "480p" => {
            "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/bv*[height<=480]+ba/b[height<=480]/b"
                .into()
        }
        _ => "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b".into(),
    }
}

fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.');
    if trimmed.is_empty() {
        "video".into()
    } else {
        trimmed.chars().take(80).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_filename;

    #[test]
    fn sanitizes_windows_name() {
        assert_eq!(sanitize_filename("a:b/c?"), "a_b_c_");
    }
}
