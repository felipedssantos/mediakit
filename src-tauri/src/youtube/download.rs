use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::types::{JobStatus, YoutubeDownloadJob};
use crate::youtube::cookies;
use crate::youtube::manager::YoutubeManager;
use crate::youtube::probe::humanize_ytdlp_error;

pub async fn run_download(app: AppHandle, manager: Arc<YoutubeManager>, job: YoutubeDownloadJob) {
    if manager.is_cancelled(&job.id) {
        manager.mark_cancelled(&job.id);
        return;
    }

    let ffmpeg = ffmpeg_binary();
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

    if let Some(browser) = cookies::preferred() {
        args.push("--cookies-from-browser".into());
        args.push(browser);
    }

    args.push(job.url.clone());

    let command = match app.shell().sidecar("yt-dlp") {
        Ok(cmd) => cmd.args(args),
        Err(err) => {
            manager.finish_job(
                &job.id,
                JobStatus::Failed,
                Some(format!("yt-dlp sidecar indisponível: {err}")),
                None,
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
                Some(format!("Falha ao iniciar o download: {err}")),
                None,
            );
            return;
        }
    };

    manager.store_child(&job.id, child);

    let mut log_tail: VecDeque<String> = VecDeque::new();
    let mut last_speed: Option<String> = None;
    let mut last_progress: f32 = 0.0;
    let mut output_path = expected_path.clone();
    let mut exit_code: Option<i32> = None;
    let mut part: u32 = 0;
    let expected_parts: u32 = if job.options.mode == "audio" { 1 } else { 2 };

    while let Some(event) = rx.recv().await {
        if manager.is_cancelled(&job.id) {
            manager.kill_child(&job.id);
            manager.mark_cancelled(&job.id);
            return;
        }

        match event {
            CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.split(['\n', '\r']) {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    if log_tail.len() >= 24 {
                        log_tail.pop_front();
                    }
                    log_tail.push_back(line.to_string());

                    if let Some(path) = parse_destination(line) {
                        output_path = path;
                        part = part.saturating_add(1);
                    }
                    if is_postprocess_line(line) {
                        last_progress = last_progress.max(99.5);
                        last_speed = Some("finalizando".into());
                        manager.update_progress(&job.id, last_progress, last_speed.clone());
                    }
                    if let Some(speed) = parse_speed(line) {
                        last_speed = Some(speed);
                    }
                    if let Some(part_progress) = parse_progress(line) {
                        let overall = overall_progress(part, expected_parts, part_progress);
                        if overall + 0.2 >= last_progress {
                            last_progress = overall;
                            manager.update_progress(&job.id, overall, last_speed.clone());
                        }
                    }
                }
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code.or(Some(0));
                break;
            }
            CommandEvent::Error(err) => {
                manager.finish_job(&job.id, JobStatus::Failed, Some(err), None);
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

    let file_ready = Path::new(&output_path).is_file() || Path::new(&expected_path).is_file();
    let resolved_path = if Path::new(&output_path).is_file() {
        output_path.clone()
    } else {
        expected_path.clone()
    };

    if exit_code.unwrap_or(0) == 0 || file_ready {
        manager.update_progress(&job.id, 100.0, last_speed);
        manager.finish_job(&job.id, JobStatus::Completed, None, Some(resolved_path));
    } else {
        let detail = log_tail.into_iter().collect::<Vec<_>>().join("\n");
        manager.finish_job(
            &job.id,
            JobStatus::Failed,
            Some(humanize_ytdlp_error(&detail)),
            None,
        );
    }
}

fn format_selector(quality: &str) -> String {
    // Prefere MP4 + M4A para remux rápido, mas cai no melhor formato do site
    // quando não há H.264/MP4 (HLS, WebM, etc.).
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

fn sidecar_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    exe.parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Pasta do executável não encontrada".into())
}

fn ffmpeg_binary() -> PathBuf {
    let dir = sidecar_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut found: Vec<PathBuf> = std::fs::read_dir(&dir)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    let lower = name.to_ascii_lowercase();
                    lower.starts_with("ffmpeg") && lower.ends_with(".exe")
                })
        })
        .collect();
    found.sort();
    found
        .into_iter()
        .next()
        .unwrap_or_else(|| dir.join("ffmpeg.exe"))
}

fn overall_progress(part: u32, expected_parts: u32, part_percent: f32) -> f32 {
    let current = part.max(1);
    let parts = expected_parts.max(current).max(1) as f32;
    let index = (current - 1) as f32;
    ((index + (part_percent / 100.0).clamp(0.0, 1.0)) / parts * 99.0).clamp(0.0, 99.4)
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

fn parse_progress(line: &str) -> Option<f32> {
    let line = line.trim();
    if !line.contains("[download]") || !line.contains('%') {
        return None;
    }
    if line.contains("Destination") {
        return None;
    }
    let percent_at = line.find('%')?;
    let before = &line[..percent_at];
    let number = before
        .rsplit(|ch: char| !ch.is_ascii_digit() && ch != '.')
        .next()?;
    let value: f32 = number.parse().ok()?;
    Some(value.clamp(0.0, 99.9))
}

fn parse_speed(line: &str) -> Option<String> {
    let marker = " at ";
    let idx = line.find(marker)?;
    let rest = &line[idx + marker.len()..];
    let speed = rest.split_whitespace().next()?;
    if speed == "Unknown" || speed.is_empty() {
        return None;
    }
    Some(speed.to_string())
}

fn parse_destination(line: &str) -> Option<String> {
    let line = line.trim();
    if line.contains("has already been downloaded") {
        if let Some(path) = line
            .strip_prefix("[download] ")
            .and_then(|rest| rest.split(" has already been downloaded").next())
        {
            return Some(path.trim().to_string());
        }
    }
    if let Some(rest) = line.strip_prefix("[download] Destination: ") {
        return Some(rest.trim().to_string());
    }
    if let Some(start) = line.find("Merging formats into \"") {
        let rest = &line[start + "Merging formats into \"".len()..];
        return rest.split('"').next().map(str::to_string);
    }
    if let Some(rest) = line.strip_prefix("[ExtractAudio] Destination: ") {
        return Some(rest.trim().to_string());
    }
    None
}

fn is_postprocess_line(line: &str) -> bool {
    line.contains("[Merger]")
        || line.contains("[ExtractAudio]")
        || line.contains("[Fixup")
        || line.contains("Deleting original file")
        || line.contains("has already been downloaded")
}

#[cfg(test)]
mod tests {
    use super::{overall_progress, parse_progress, parse_speed, sanitize_filename};

    #[test]
    fn parses_percent() {
        let value = parse_progress("[download]  12.4% of  40.00MiB at  1.10MiB/s ETA 00:25").unwrap();
        assert!((value - 12.4).abs() < 0.01);
    }

    #[test]
    fn maps_two_part_download() {
        let video_done = overall_progress(1, 2, 100.0);
        let audio_half = overall_progress(2, 2, 50.0);
        assert!((video_done - 49.5).abs() < 0.1);
        assert!((audio_half - 74.25).abs() < 0.1);
        assert!(audio_half > video_done);
    }

    #[test]
    fn parses_speed() {
        assert_eq!(
            parse_speed("[download]  12.4% of  40.00MiB at  1.10MiB/s ETA 00:25").unwrap(),
            "1.10MiB/s"
        );
    }

    #[test]
    fn sanitizes_windows_name() {
        assert_eq!(sanitize_filename("a:b/c?"), "a_b_c_");
    }
}
