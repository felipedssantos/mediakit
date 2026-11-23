use std::collections::VecDeque;
use std::path::{Path, PathBuf};

use tauri::async_runtime::Receiver;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent, Output};
use tauri_plugin_shell::ShellExt;

use crate::error::{AppError, AppResult};

const MAX_TAIL_LINES: usize = 24;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamSource {
    Stdout,
    Stderr,
}

pub struct StreamOutcome {
    pub exit_code: Option<i32>,
    pub tail: Vec<String>,
    pub cancelled: bool,
}

/// Runs a sidecar command to completion and returns its buffered output.
pub async fn run_output(app: &AppHandle, name: &'static str, args: &[String]) -> AppResult<Output> {
    let sidecar = app
        .shell()
        .sidecar(name)
        .map_err(|err| AppError::SidecarUnavailable {
            name,
            detail: err.to_string(),
        })?;
    sidecar
        .args(args)
        .output()
        .await
        .map_err(|err| AppError::SidecarExec {
            name,
            detail: err.to_string(),
        })
}

/// Spawns a streaming sidecar process and returns its event receiver and child handle.
pub fn spawn_sidecar(
    app: &AppHandle,
    name: &'static str,
    args: Vec<String>,
) -> AppResult<(Receiver<CommandEvent>, CommandChild)> {
    let sidecar = app
        .shell()
        .sidecar(name)
        .map_err(|err| AppError::SidecarUnavailable {
            name,
            detail: err.to_string(),
        })?;
    sidecar
        .args(args)
        .spawn()
        .map_err(|err| AppError::SidecarExec {
            name,
            detail: err.to_string(),
        })
}

/// Streams stdout/stderr lines from a spawned sidecar while polling cancellation.
pub async fn stream_lines<F>(
    rx: &mut Receiver<CommandEvent>,
    split_cr: bool,
    tail_both_streams: bool,
    is_cancelled: impl Fn() -> bool,
    on_cancel: impl Fn(),
    mut on_line: F,
) -> AppResult<StreamOutcome>
where
    F: FnMut(StreamSource, &str),
{
    let mut tail: VecDeque<String> = VecDeque::new();
    let mut exit_code: Option<i32> = None;

    while let Some(event) = rx.recv().await {
        if is_cancelled() {
            on_cancel();
            return Ok(StreamOutcome {
                exit_code,
                tail: tail.into_iter().collect(),
                cancelled: true,
            });
        }

        match event {
            CommandEvent::Stdout(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in split_lines(&text, split_cr) {
                    if tail_both_streams {
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            continue;
                        }
                        push_tail(&mut tail, trimmed);
                        on_line(StreamSource::Stdout, trimmed);
                    } else {
                        on_line(StreamSource::Stdout, line);
                    }
                }
            }
            CommandEvent::Stderr(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in split_lines(&text, split_cr) {
                    if tail_both_streams {
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            continue;
                        }
                        push_tail(&mut tail, trimmed);
                        on_line(StreamSource::Stderr, trimmed);
                    } else {
                        push_tail(&mut tail, line);
                        on_line(StreamSource::Stderr, line);
                    }
                }
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
                if tail_both_streams {
                    exit_code = exit_code.or(Some(0));
                    break;
                }
            }
            CommandEvent::Error(err) => {
                return Err(AppError::Message(err));
            }
            _ => {}
        }
    }

    Ok(StreamOutcome {
        exit_code,
        tail: tail.into_iter().collect(),
        cancelled: false,
    })
}

fn split_lines(text: &str, split_cr: bool) -> Box<dyn Iterator<Item = &str> + '_> {
    if split_cr {
        Box::new(text.split(['\n', '\r']))
    } else {
        Box::new(text.lines())
    }
}

fn push_tail(tail: &mut VecDeque<String>, line: &str) {
    if tail.len() >= MAX_TAIL_LINES {
        tail.pop_front();
    }
    tail.push_back(line.to_string());
}

/// Resolves the bundled FFmpeg sidecar path next to the running executable.
///
/// `yt-dlp` spawns FFmpeg directly as a child process when merging streams or
/// extracting audio, so Tauri's `ShellExt::sidecar` cannot launch FFmpeg on its
/// behalf and `--ffmpeg-location` needs the resolved filesystem path.
pub fn bundled_sidecar_path(name: &str) -> PathBuf {
    let dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."));

    let plain = dir.join(format!("{name}.exe"));
    if plain.is_file() {
        return plain;
    }

    let triple_name = format!("{name}-x86_64-pc-windows-msvc.exe");
    let suffixed = dir.join(triple_name);
    if suffixed.is_file() {
        return suffixed;
    }

    plain
}
