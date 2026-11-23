use std::collections::VecDeque;
use std::sync::Arc;

use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::manager::JobManager;
use crate::presets::build_args;
use crate::probe;
use crate::types::{Job, JobStatus};

pub async fn run_job(app: AppHandle, manager: Arc<JobManager>, mut job: Job) {
    if manager.is_cancelled(&job.id) {
        manager.mark_cancelled(&job.id);
        return;
    }

    let media = match probe::probe_media(&app, &job.input_path).await {
        Ok(info) => info,
        Err(err) => {
            manager.finish_job(&job.id, JobStatus::Failed, Some(err));
            return;
        }
    };
    job.duration = media.duration;
    manager.update_duration(&job.id, media.duration);
    let still_image = media.duration <= 0.05;

    let args = match build_args(
        &job.input_path,
        &job.output_path,
        &job.options,
        Some(&media),
    ) {
        Ok(args) => args,
        Err(err) => {
            manager.finish_job(&job.id, JobStatus::Failed, Some(err));
            return;
        }
    };

    let command = match app.shell().sidecar("ffmpeg") {
        Ok(cmd) => cmd.args(args),
        Err(err) => {
            manager.finish_job(
                &job.id,
                JobStatus::Failed,
                Some(format!("FFmpeg sidecar indisponível: {err}")),
            );
            return;
        }
    };

    let (mut rx, child) = match command.spawn() {
        Ok(pair) => pair,
        Err(err) => {
            manager.finish_job(
                &job.id,
                JobStatus::Failed,
                Some(format!("Falha ao iniciar FFmpeg: {err}")),
            );
            return;
        }
    };

    manager.store_child(&job.id, child);
    if still_image {
        manager.update_progress(&job.id, 20.0, None);
    }

    let mut stderr_tail: VecDeque<String> = VecDeque::new();
    let mut last_speed: Option<String> = None;
    let mut exit_code: Option<i32> = None;

    while let Some(event) = rx.recv().await {
        if manager.is_cancelled(&job.id) {
            manager.kill_child(&job.id);
            manager.mark_cancelled(&job.id);
            return;
        }

        match event {
            CommandEvent::Stdout(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    if let Some(speed) = parse_speed(line) {
                        last_speed = Some(speed);
                    }
                    if let Some(progress) = parse_progress(line, job.duration) {
                        manager.update_progress(&job.id, progress, last_speed.clone());
                    }
                }
            }
            CommandEvent::Stderr(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    if stderr_tail.len() >= 24 {
                        stderr_tail.pop_front();
                    }
                    stderr_tail.push_back(line.to_string());
                    if let Some(speed) = parse_speed(line) {
                        last_speed = Some(speed);
                    }
                }
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
            }
            CommandEvent::Error(err) => {
                manager.finish_job(&job.id, JobStatus::Failed, Some(err));
                return;
            }
            _ => {}
        }
    }

    manager.take_child(&job.id);

    if manager.is_cancelled(&job.id) {
        manager.mark_cancelled(&job.id);
        return;
    }

    if exit_code.unwrap_or(-1) == 0 {
        manager.update_progress(&job.id, 100.0, last_speed);
        manager.finish_job(&job.id, JobStatus::Completed, None);
    } else {
        let detail = stderr_tail.into_iter().collect::<Vec<_>>().join("\n");
        let message = if detail.trim().is_empty() {
            format!("FFmpeg encerrou com código {}", exit_code.unwrap_or(-1))
        } else {
            format!(
                "FFmpeg encerrou com código {}: {detail}",
                exit_code.unwrap_or(-1)
            )
        };
        manager.finish_job(&job.id, JobStatus::Failed, Some(message));
    }
}

fn parse_progress(line: &str, duration: f64) -> Option<f32> {
    let line = line.trim();
    let seconds = parse_out_time_seconds(line)?;
    if duration <= 0.05 {
        return None;
    }
    Some(((seconds / duration) * 100.0).clamp(0.0, 99.9) as f32)
}

/// FFmpeg `-progress` prints `out_time_ms` with a microsecond value (legacy name).
/// Prefer `out_time_us` / `out_time=` and never scale `out_time_ms` as milliseconds.
fn parse_out_time_seconds(line: &str) -> Option<f64> {
    if line.ends_with("=N/A") {
        return None;
    }
    let seconds = if let Some(rest) = line.strip_prefix("out_time_us=") {
        rest.parse::<f64>().ok()? / 1_000_000.0
    } else if let Some(rest) = line.strip_prefix("out_time_ms=") {
        rest.parse::<f64>().ok()? / 1_000_000.0
    } else {
        let rest = line.strip_prefix("out_time=")?;
        parse_timestamp(rest)?
    };
    if seconds.is_finite() && seconds >= 0.0 {
        Some(seconds)
    } else {
        None
    }
}

fn parse_timestamp(value: &str) -> Option<f64> {
    let mut parts = value.split(':');
    let hours: f64 = parts.next()?.parse().ok()?;
    let minutes: f64 = parts.next()?.parse().ok()?;
    let seconds: f64 = parts.next()?.parse().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

fn parse_speed(line: &str) -> Option<String> {
    for part in line.split([' ', '\t', '\r']) {
        if let Some(value) = part.strip_prefix("speed=") {
            let trimmed = value.trim();
            if !trimmed.is_empty() && trimmed != "N/A" {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

pub async fn detect_nvenc(app: &AppHandle) -> Result<bool, String> {
    let sidecar = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("FFmpeg sidecar indisponível: {e}"))?;
    let output = sidecar
        .args(["-hide_banner", "-encoders"])
        .output()
        .await
        .map_err(|e| format!("Falha ao listar encoders: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.contains("h264_nvenc") || stdout.contains("hevc_nvenc"))
}

#[cfg(test)]
mod tests {
    use super::{parse_out_time_seconds, parse_progress};

    #[test]
    fn out_time_ms_is_microseconds() {
        // 5 seconds encoded of a 50s file => 10%, not 1000%
        assert_eq!(parse_out_time_seconds("out_time_ms=5000000").unwrap(), 5.0);
        let progress = parse_progress("out_time_ms=5000000", 50.0).unwrap();
        assert!((progress - 10.0).abs() < 0.01);
    }

    #[test]
    fn out_time_us_matches_ms() {
        assert_eq!(
            parse_out_time_seconds("out_time_us=5000000").unwrap(),
            parse_out_time_seconds("out_time_ms=5000000").unwrap()
        );
    }

    #[test]
    fn out_time_timestamp() {
        assert!((parse_out_time_seconds("out_time=00:01:30.500000").unwrap() - 90.5).abs() < 0.001);
    }
}
