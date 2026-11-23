use std::collections::VecDeque;
use std::fs;
#[cfg(windows)]
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::sync::atomic::{AtomicBool, Ordering};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
#[cfg(windows)]
use sha2::{Digest, Sha256};
use tauri::async_runtime::Receiver;
#[cfg(windows)]
use tauri::Emitter;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{Command, CommandChild, CommandEvent, Output};
use tauri_plugin_shell::ShellExt;
#[cfg(windows)]
use zip::ZipArchive;

use crate::error::{AppError, AppResult};
use crate::worker::ffmpeg::invalidate_hw_cache;

const MAX_TAIL_LINES: usize = 24;

#[cfg(windows)]
const FFMPEG_VERSION: &str = "9.1";
#[cfg(windows)]
const FFMPEG_URL: &str =
    "https://github.com/GyanD/codexffmpeg/releases/download/9.1/ffmpeg-9.1-essentials_build.zip";
#[cfg(windows)]
const FFMPEG_SHA256: &str = "b9bbbb3acece000cbeec994f856649354e52c773807841e78908374b24d658fd";

#[cfg(windows)]
const YTDLP_VERSION: &str = "2026.10.26";
#[cfg(windows)]
const YTDLP_URL: &str = "https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp.exe";
#[cfg(windows)]
const YTDLP_SHA256: &str = "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d";

fn bin_filename(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

fn target_triple() -> &'static str {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        "x86_64-pc-windows-msvc"
    }
    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    {
        "aarch64-pc-windows-msvc"
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        "x86_64-unknown-linux-gnu"
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        "aarch64-unknown-linux-gnu"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "x86_64-apple-darwin"
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "aarch64-apple-darwin"
    }
}

#[cfg(not(windows))]
fn find_in_path(bin_name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    std::env::split_paths(&path_var)
        .map(|dir| dir.join(bin_name))
        .find(|candidate| candidate.is_file())
}

static CONFIG_CACHE: Mutex<Option<SidecarConfig>> = Mutex::new(None);
#[cfg(windows)]
static REPAIR_ACTIVE: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
struct RepairGuard;

#[cfg(windows)]
impl RepairGuard {
    fn try_acquire() -> Option<Self> {
        REPAIR_ACTIVE
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .ok()
            .map(|_| Self)
    }
}

#[cfg(windows)]
impl Drop for RepairGuard {
    fn drop(&mut self) {
        REPAIR_ACTIVE.store(false, Ordering::SeqCst);
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct SidecarConfig {
    pub custom_dir: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub ytdlp_path: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SidecarSource {
    Custom,
    Repaired,
    Bundled,
    Missing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarInfo {
    pub name: String,
    pub ok: bool,
    pub source: SidecarSource,
    pub path: Option<String>,
    pub error: Option<String>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarStatusReport {
    pub all_ok: bool,
    pub items: Vec<SidecarInfo>,
}

#[cfg(windows)]
#[derive(Debug, Clone, Serialize)]
pub struct SidecarRepairProgress {
    pub component: String,
    pub stage: String,
    pub percent: Option<u8>,
    pub message: String,
}

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

fn config_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_local_data_dir()
        .ok()
        .map(|dir| dir.join("sidecars.json"))
}

fn repaired_binaries_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| AppError::message(format!("Pasta de dados do app indisponível: {e}")))?
        .join("binaries");
    Ok(dir)
}

fn normalize_optional_path(value: Option<String>) -> Option<String> {
    value.and_then(|s| {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub fn load_sidecar_config(app: &AppHandle) -> SidecarConfig {
    if let Some(cached) = CONFIG_CACHE.lock().clone() {
        return cached;
    }
    let loaded = config_file_path(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<SidecarConfig>(&raw).ok())
        .unwrap_or_default();
    *CONFIG_CACHE.lock() = Some(loaded.clone());
    loaded
}

pub fn save_sidecar_config(app: &AppHandle, config: SidecarConfig) -> AppResult<SidecarConfig> {
    let normalized = SidecarConfig {
        custom_dir: normalize_optional_path(config.custom_dir),
        ffmpeg_path: normalize_optional_path(config.ffmpeg_path),
        ffprobe_path: normalize_optional_path(config.ffprobe_path),
        ytdlp_path: normalize_optional_path(config.ytdlp_path),
    };

    if let Some(path) = config_file_path(app) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(&normalized)
            .map_err(|e| AppError::message(format!("Erro ao serializar configuração: {e}")))?;
        fs::write(path, json)?;
    }

    *CONFIG_CACHE.lock() = Some(normalized.clone());
    invalidate_hw_cache();
    Ok(normalized)
}

fn custom_exe_for<'a>(config: &'a SidecarConfig, name: &str) -> Option<&'a str> {
    match name {
        "ffmpeg" => config.ffmpeg_path.as_deref(),
        "ffprobe" => config.ffprobe_path.as_deref(),
        "yt-dlp" => config.ytdlp_path.as_deref(),
        _ => None,
    }
}

fn resolve_from_parts(
    config: &SidecarConfig,
    repaired_dir: Option<&Path>,
    name: &str,
) -> (SidecarSource, Option<PathBuf>) {
    let bin_name = bin_filename(name);

    if let Some(custom_exe) = custom_exe_for(config, name) {
        let p = PathBuf::from(custom_exe);
        if p.is_file() {
            return (SidecarSource::Custom, Some(p));
        }
        let nested = p.join(&bin_name);
        if nested.is_file() {
            return (SidecarSource::Custom, Some(nested));
        }
        return (SidecarSource::Missing, Some(p));
    }

    if let Some(dir) = config.custom_dir.as_deref() {
        let candidate = Path::new(dir).join(&bin_name);
        if candidate.is_file() {
            return (SidecarSource::Custom, Some(candidate));
        }
    }

    if let Some(dir) = repaired_dir {
        let candidate = dir.join(&bin_name);
        if candidate.is_file() {
            return (SidecarSource::Repaired, Some(candidate));
        }
    }

    let bundled = bundled_sidecar_path(name);
    if bundled.is_file() {
        return (SidecarSource::Bundled, Some(bundled));
    }

    #[cfg(not(windows))]
    if let Some(system_bin) = find_in_path(&bin_name) {
        return (SidecarSource::Bundled, Some(system_bin));
    }

    (SidecarSource::Missing, None)
}

fn resolve_command(app: &AppHandle, name: &'static str) -> AppResult<Command> {
    let config = load_sidecar_config(app);
    let repaired_dir = repaired_binaries_dir(app).ok();
    let (source, path) = resolve_from_parts(&config, repaired_dir.as_deref(), name);

    match (source, path) {
        (SidecarSource::Custom | SidecarSource::Repaired, Some(exe)) => {
            Ok(app.shell().command(exe))
        }
        (SidecarSource::Bundled, Some(exe)) => {
            if bundled_sidecar_path(name).is_file() {
                app.shell()
                    .sidecar(name)
                    .map_err(|err| AppError::SidecarUnavailable {
                        name,
                        detail: err.to_string(),
                    })
            } else {
                Ok(app.shell().command(exe))
            }
        }
        (SidecarSource::Bundled, None) => {
            app.shell()
                .sidecar(name)
                .map_err(|err| AppError::SidecarUnavailable {
                    name,
                    detail: err.to_string(),
                })
        }
        (_, Some(path)) => Err(AppError::SidecarUnavailable {
            name,
            detail: format!("Arquivo não encontrado em '{}'", path.display()),
        }),
        (_, None) => Err(AppError::SidecarUnavailable {
            name,
            detail: "Arquivo executável ausente ou bloqueado".to_string(),
        }),
    }
}

/// Resolves the active filesystem path for a sidecar (`custom` -> `repaired` -> `bundled`).
pub fn resolve_sidecar_path(app: &AppHandle, name: &str) -> PathBuf {
    let config = load_sidecar_config(app);
    let repaired_dir = repaired_binaries_dir(app).ok();
    let (_, path) = resolve_from_parts(&config, repaired_dir.as_deref(), name);
    path.unwrap_or_else(|| bundled_sidecar_path(name))
}

/// Runs a sidecar command to completion and returns its buffered output.
pub async fn run_output(app: &AppHandle, name: &'static str, args: &[String]) -> AppResult<Output> {
    let sidecar = resolve_command(app, name)?;
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
    let sidecar = resolve_command(app, name)?;
    sidecar
        .args(args)
        .spawn()
        .map_err(|err| AppError::SidecarExec {
            name,
            detail: err.to_string(),
        })
}

/// Checks whether `ffmpeg`, `ffprobe`, and `yt-dlp` are present and executable.
pub async fn check_sidecars(app: &AppHandle) -> SidecarStatusReport {
    let targets: &[(&'static str, &'static str)] = &[
        ("ffmpeg", "-version"),
        ("ffprobe", "-version"),
        ("yt-dlp", "--version"),
    ];

    let mut handles = Vec::with_capacity(targets.len());
    for &(name, version_arg) in targets {
        let app_clone = app.clone();
        handles.push(tauri::async_runtime::spawn(async move {
            check_single_sidecar(&app_clone, name, version_arg).await
        }));
    }

    let mut items = Vec::with_capacity(targets.len());
    for handle in handles {
        if let Ok(info) = handle.await {
            items.push(info);
        }
    }

    let all_ok = items.iter().all(|item| item.ok);
    SidecarStatusReport { all_ok, items }
}

fn format_sidecar_error(
    name: &str,
    source: SidecarSource,
    path: Option<&Path>,
    raw_error: &str,
) -> (String, String) {
    let filename = path
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or(name);

    let expected_bin = bin_filename(name);
    match source {
        SidecarSource::Custom => {
            let problem = format!(
                "O arquivo selecionado ('{filename}') não é o {name} genuíno ou falhou ao responder ao teste de versão."
            );
            let solution = format!(
                "Clique em 'Limpar' ao lado do campo para voltar a usar o binário padrão do aplicativo ou selecione o arquivo {expected_bin} correto."
            );
            (problem, solution)
        }
        SidecarSource::Missing => {
            let problem = if let Some(p) = path {
                format!(
                    "O arquivo executável não existe no caminho configurado: '{}'",
                    p.display()
                )
            } else {
                format!("O executável {expected_bin} não foi encontrado na pasta do aplicativo (pode ter sido apagado ou bloqueado).")
            };
            let solution = "Clique no botão 'Auto-reparar' para baixar e restaurar os componentes automaticamente.".to_string();
            (problem, solution)
        }
        SidecarSource::Bundled | SidecarSource::Repaired => {
            let problem = format!("Falha ao executar o {name} integrado: {raw_error}.");
            let solution = "Verifique as permissões do executável ou clique em 'Auto-reparar' para reinstalar os componentes.".to_string();
            (problem, solution)
        }
    }
}

async fn check_single_sidecar(
    app: &AppHandle,
    name: &'static str,
    version_arg: &'static str,
) -> SidecarInfo {
    let config = load_sidecar_config(app);
    let repaired_dir = repaired_binaries_dir(app).ok();
    let (source, path) = resolve_from_parts(&config, repaired_dir.as_deref(), name);
    let path_str = path.as_ref().map(|p| p.to_string_lossy().into_owned());

    if source == SidecarSource::Missing {
        let (err_msg, suggestion) =
            format_sidecar_error(name, source, path.as_deref(), "Arquivo não encontrado");
        return SidecarInfo {
            name: name.to_string(),
            ok: false,
            source,
            path: path_str,
            error: Some(err_msg),
            suggestion: Some(suggestion),
        };
    }

    let args = vec![version_arg.to_string()];
    match run_output(app, name, &args).await {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let is_valid = match name {
                "ffmpeg" => stdout.contains("ffmpeg version"),
                "ffprobe" => stdout.contains("ffprobe version"),
                "yt-dlp" => !stdout.trim().is_empty(),
                _ => true,
            };
            if is_valid {
                SidecarInfo {
                    name: name.to_string(),
                    ok: true,
                    source,
                    path: path_str,
                    error: None,
                    suggestion: None,
                }
            } else {
                let (err_msg, suggestion) = format_sidecar_error(
                    name,
                    source,
                    path.as_deref(),
                    "Resposta do executável não confere",
                );
                SidecarInfo {
                    name: name.to_string(),
                    ok: false,
                    source,
                    path: path_str,
                    error: Some(err_msg),
                    suggestion: Some(suggestion),
                }
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let raw_msg = if stderr.is_empty() {
                format!("Encerrou com código {:?}", output.status.code())
            } else {
                stderr
            };
            let (err_msg, suggestion) =
                format_sidecar_error(name, source, path.as_deref(), &raw_msg);
            SidecarInfo {
                name: name.to_string(),
                ok: false,
                source,
                path: path_str,
                error: Some(err_msg),
                suggestion: Some(suggestion),
            }
        }
        Err(err) => {
            let (err_msg, suggestion) =
                format_sidecar_error(name, source, path.as_deref(), &err.to_string());
            SidecarInfo {
                name: name.to_string(),
                ok: false,
                source,
                path: path_str,
                error: Some(err_msg),
                suggestion: Some(suggestion),
            }
        }
    }
}

#[cfg(windows)]
fn emit_repair_progress(
    app: &AppHandle,
    component: &str,
    stage: &str,
    percent: Option<u8>,
    message: impl Into<String>,
) {
    let _ = app.emit(
        "sidecar-repair-progress",
        SidecarRepairProgress {
            component: component.to_string(),
            stage: stage.to_string(),
            percent,
            message: message.into(),
        },
    );
}

#[cfg(windows)]
async fn download_and_verify(
    app: &AppHandle,
    client: &reqwest::Client,
    component: &str,
    url: &str,
    expected_sha256: &str,
) -> AppResult<Vec<u8>> {
    emit_repair_progress(
        app,
        component,
        "downloading",
        Some(0),
        format!("Baixando {component}..."),
    );

    let mut resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::message(format!("Falha ao baixar {component}: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::message(format!("Erro HTTP ao baixar {component}: {e}")))?;

    let total = resp.content_length();
    let mut downloaded: u64 = 0;
    let mut last_percent: u8 = 0;
    let mut buffer = Vec::with_capacity(total.unwrap_or(0) as usize);
    let mut hasher = Sha256::new();

    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| AppError::message(format!("Erro de leitura ao baixar {component}: {e}")))?
    {
        hasher.update(&chunk);
        buffer.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;

        if let Some(pct) = total.and_then(|total_bytes| {
            (downloaded * 100)
                .checked_div(total_bytes)
                .map(|p| p.min(100) as u8)
        }) {
            if pct >= last_percent.saturating_add(4) || pct == 100 {
                last_percent = pct;
                emit_repair_progress(
                    app,
                    component,
                    "downloading",
                    Some(pct),
                    format!("Baixando {component}... {pct}%"),
                );
            }
        }
    }

    emit_repair_progress(
        app,
        component,
        "verifying",
        Some(100),
        format!("Verificando integridade SHA-256 de {component}..."),
    );

    let actual_sha256 = format!("{:x}", hasher.finalize());
    if actual_sha256 != expected_sha256 {
        return Err(AppError::message(format!(
            "Falha na verificação SHA-256 de {component}. Esperado: {expected_sha256}, obtido: {actual_sha256}"
        )));
    }

    Ok(buffer)
}

#[cfg(windows)]
fn extract_ffmpeg_zip(zip_bytes: Vec<u8>, dest_dir: &Path) -> AppResult<()> {
    fs::create_dir_all(dest_dir)?;
    let cursor = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|e| AppError::message(format!("Arquivo ZIP do FFmpeg inválido: {e}")))?;

    let mut found_ffmpeg = false;
    let mut found_ffprobe = false;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| AppError::message(format!("Erro ao ler ZIP do FFmpeg: {e}")))?;
        if !entry.is_file() {
            continue;
        }
        let Some(file_name) = Path::new(entry.name())
            .file_name()
            .and_then(|n| n.to_str())
            .map(str::to_owned)
        else {
            continue;
        };
        if file_name != "ffmpeg.exe" && file_name != "ffprobe.exe" {
            continue;
        }

        let target = dest_dir.join(&file_name);
        let tmp = dest_dir.join(format!("{file_name}.tmp"));
        let mut buf = Vec::with_capacity(entry.size() as usize);
        entry.read_to_end(&mut buf)?;
        {
            let mut file = fs::File::create(&tmp)?;
            file.write_all(&buf)?;
            file.sync_all()?;
        }
        if target.exists() {
            let _ = fs::remove_file(&target);
        }
        fs::rename(&tmp, &target)?;

        if file_name == "ffmpeg.exe" {
            found_ffmpeg = true;
        } else {
            found_ffprobe = true;
        }
    }

    if !found_ffmpeg || !found_ffprobe {
        return Err(AppError::message(
            "ffmpeg.exe ou ffprobe.exe não encontrados no pacote baixado",
        ));
    }

    Ok(())
}

/// Downloads and verifies missing sidecars into `$APPLOCALDATA/binaries` (Windows only).
#[cfg(not(windows))]
pub async fn repair_sidecars(
    _app: &AppHandle,
    _targets: Option<Vec<String>>,
) -> AppResult<SidecarStatusReport> {
    Err(AppError::message(
        "Auto-reparo automático é suportado apenas no Windows. No Linux/macOS, instale ffmpeg e yt-dlp pelo gerenciador de pacotes do sistema ou selecione os executáveis manualmente.",
    ))
}

/// Downloads and verifies missing sidecars into `$APPLOCALDATA/binaries`.
#[cfg(windows)]
pub async fn repair_sidecars(
    app: &AppHandle,
    targets: Option<Vec<String>>,
) -> AppResult<SidecarStatusReport> {
    let _guard = RepairGuard::try_acquire()
        .ok_or_else(|| AppError::message("Auto-reparo já está em andamento"))?;

    let status = check_sidecars(app).await;
    let target_set: Vec<String> = match targets {
        Some(list) if !list.is_empty() => list,
        _ => status
            .items
            .iter()
            .filter(|item| !item.ok)
            .map(|item| item.name.clone())
            .collect(),
    };

    if target_set.is_empty() {
        return Ok(status);
    }

    let dest_dir = repaired_binaries_dir(app)?;
    fs::create_dir_all(&dest_dir)?;

    let client = reqwest::Client::builder()
        .user_agent(concat!("mediakit-app/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| AppError::message(format!("Erro ao iniciar cliente HTTP: {e}")))?;

    let need_ffmpeg = target_set.iter().any(|n| n == "ffmpeg" || n == "ffprobe");
    let need_ytdlp = target_set.iter().any(|n| n == "yt-dlp");

    if need_ffmpeg {
        let zip_bytes = download_and_verify(
            app,
            &client,
            &format!("FFmpeg {FFMPEG_VERSION}"),
            FFMPEG_URL,
            FFMPEG_SHA256,
        )
        .await?;

        emit_repair_progress(
            app,
            "FFmpeg",
            "extracting",
            None,
            "Extraindo ffmpeg.exe e ffprobe.exe...",
        );

        let dir_clone = dest_dir.clone();
        tauri::async_runtime::spawn_blocking(move || extract_ffmpeg_zip(zip_bytes, &dir_clone))
            .await
            .map_err(|e| AppError::message(format!("Falha ao extrair FFmpeg: {e}")))??;
    }

    if need_ytdlp {
        let exe_bytes = download_and_verify(
            app,
            &client,
            &format!("yt-dlp {YTDLP_VERSION}"),
            YTDLP_URL,
            YTDLP_SHA256,
        )
        .await?;

        let target = dest_dir.join("yt-dlp.exe");
        let tmp = dest_dir.join("yt-dlp.exe.tmp");
        tauri::async_runtime::spawn_blocking(move || -> AppResult<()> {
            {
                let mut file = fs::File::create(&tmp)?;
                file.write_all(&exe_bytes)?;
                file.sync_all()?;
            }
            if target.exists() {
                let _ = fs::remove_file(&target);
            }
            fs::rename(&tmp, &target)?;
            Ok(())
        })
        .await
        .map_err(|e| AppError::message(format!("Falha ao salvar yt-dlp.exe: {e}")))??;
    }

    invalidate_hw_cache();
    emit_repair_progress(
        app,
        "all",
        "done",
        Some(100),
        "Componentes reparados com sucesso.",
    );

    Ok(check_sidecars(app).await)
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

    let plain = dir.join(bin_filename(name));
    if plain.is_file() {
        return plain;
    }

    let triple_name = format!("{name}-{}", target_triple());
    let suffixed = dir.join(bin_filename(&triple_name));
    if suffixed.is_file() {
        return suffixed;
    }

    plain
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_test_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("mediakit_sidecar_{tag}_{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn resolves_custom_exe_before_custom_dir_and_repaired() {
        let root = temp_test_dir("priority");
        let custom_dir = root.join("custom");
        let repaired_dir = root.join("repaired");
        fs::create_dir_all(&custom_dir).unwrap();
        fs::create_dir_all(&repaired_dir).unwrap();

        let explicit_exe = root.join(bin_filename("my-ffmpeg"));
        let dir_exe = custom_dir.join(bin_filename("ffmpeg"));
        let rep_exe = repaired_dir.join(bin_filename("ffmpeg"));
        let rep_probe = repaired_dir.join(bin_filename("ffprobe"));
        fs::write(&explicit_exe, b"exe").unwrap();
        fs::write(&dir_exe, b"dir").unwrap();
        fs::write(&rep_exe, b"rep").unwrap();
        fs::write(&rep_probe, b"rep_probe").unwrap();

        let config = SidecarConfig {
            custom_dir: Some(custom_dir.to_string_lossy().into_owned()),
            ffmpeg_path: Some(explicit_exe.to_string_lossy().into_owned()),
            ffprobe_path: None,
            ytdlp_path: None,
        };

        let (src, path) = resolve_from_parts(&config, Some(&repaired_dir), "ffmpeg");
        assert_eq!(src, SidecarSource::Custom);
        assert_eq!(path, Some(explicit_exe));

        let (src_probe, path_probe) = resolve_from_parts(&config, Some(&repaired_dir), "ffprobe");
        assert_eq!(src_probe, SidecarSource::Repaired);
        assert_eq!(path_probe, Some(repaired_dir.join(bin_filename("ffprobe"))));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_custom_dir_when_exe_present() {
        let root = temp_test_dir("dir");
        let custom_dir = root.join("bin");
        fs::create_dir_all(&custom_dir).unwrap();
        let ytdlp = custom_dir.join(bin_filename("yt-dlp"));
        fs::write(&ytdlp, b"yt").unwrap();

        let config = SidecarConfig {
            custom_dir: Some(custom_dir.to_string_lossy().into_owned()),
            ..Default::default()
        };

        let (src, path) = resolve_from_parts(&config, None, "yt-dlp");
        assert_eq!(src, SidecarSource::Custom);
        assert_eq!(path, Some(ytdlp));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn custom_invalid_exe_marks_missing_without_fallback() {
        let root = temp_test_dir("invalid");
        let invalid_exe = root.join(bin_filename("nao_existe"));

        let config_exe = SidecarConfig {
            ffmpeg_path: Some(invalid_exe.to_string_lossy().into_owned()),
            ..Default::default()
        };
        let (src, path) = resolve_from_parts(&config_exe, None, "ffmpeg");
        assert_eq!(src, SidecarSource::Missing);
        assert_eq!(path, Some(invalid_exe));

        let _ = fs::remove_dir_all(root);
    }
}
