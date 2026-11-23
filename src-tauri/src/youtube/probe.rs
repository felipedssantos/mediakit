use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::types::YoutubeVideo;
use crate::youtube::cookies;

pub async fn probe_url(app: &AppHandle, url: &str) -> Result<YoutubeVideo, String> {
    if url.trim().is_empty() {
        return Err("Cole um link de vídeo para continuar".into());
    }

    let mut last_detail = String::new();
    for browser in cookies::attempts() {
        match probe_once(app, url, browser.as_deref()).await {
            Ok(video) => {
                cookies::remember(browser);
                return Ok(video);
            }
            Err(detail) => {
                last_detail = detail;
                if !cookies::should_try_next_browser(&last_detail) {
                    return Err(humanize_ytdlp_error(&last_detail));
                }
            }
        }
    }

    Err(humanize_ytdlp_error(&last_detail))
}

async fn probe_once(
    app: &AppHandle,
    url: &str,
    browser: Option<&str>,
) -> Result<YoutubeVideo, String> {
    let sidecar = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| format!("yt-dlp sidecar indisponível: {e}"))?;

    let mut args = vec![
        "-J".into(),
        "--no-warnings".into(),
        "--no-playlist".into(),
        "--skip-download".into(),
    ];
    if let Some(name) = browser {
        args.push("--cookies-from-browser".into());
        args.push(name.to_string());
    }
    args.push(url.to_string());

    let output = sidecar
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Falha ao consultar o vídeo: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if !stderr.trim().is_empty() {
            stderr
        } else {
            stdout
        };
        return Err(detail.into_owned());
    }

    let json: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Resposta inválida do yt-dlp: {e}"))?;

    parse_video(json)
}

fn parse_video(json: Value) -> Result<YoutubeVideo, String> {
    if json.get("_type").and_then(Value::as_str) == Some("playlist") {
        return Err("Este link é uma playlist. Abra um vídeo específico para baixar.".into());
    }

    let id = json
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("video")
        .to_string();
    let title = json
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("Vídeo")
        .to_string();
    let channel = json
        .get("channel")
        .or_else(|| json.get("uploader"))
        .and_then(Value::as_str)
        .unwrap_or("Canal desconhecido")
        .to_string();
    let duration = json.get("duration").and_then(Value::as_f64).unwrap_or(0.0);
    let thumbnail = json
        .get("thumbnail")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            json.get("thumbnails")
                .and_then(Value::as_array)
                .and_then(|items| items.last())
                .and_then(|item| item.get("url"))
                .and_then(Value::as_str)
                .map(str::to_string)
        });
    let url = json
        .get("webpage_url")
        .or_else(|| json.get("original_url"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    Ok(YoutubeVideo {
        id,
        title,
        channel,
        duration,
        thumbnail,
        url,
        source: source_from_json(&json),
    })
}

fn source_from_json(json: &Value) -> Option<String> {
    json.get("extractor_key")
        .or_else(|| json.get("extractor"))
        .and_then(Value::as_str)
        .map(|raw| {
            let trimmed = raw.trim();
            trimmed.strip_suffix("IE").unwrap_or(trimmed).to_string()
        })
        .filter(|name| !name.is_empty() && !name.eq_ignore_ascii_case("generic"))
}

pub fn humanize_ytdlp_error(detail: &str) -> String {
    let trimmed = detail.trim();
    if trimmed.starts_with("Este ")
        || trimmed.starts_with("Não ")
        || trimmed.starts_with("Cole ")
        || trimmed.starts_with("Falha ")
        || trimmed.starts_with("Resposta ")
        || trimmed.starts_with("yt-dlp ")
    {
        return trimmed.to_string();
    }

    let lower = detail.to_lowercase();
    if lower.contains("video unavailable") || lower.contains("private video") {
        "Este vídeo não está disponível (privado, removido ou restrito).".into()
    } else if lower.contains("sign in")
        || lower.contains("login required")
        || lower.contains("cookies")
        || lower.contains("failed to load cookies")
        || lower.contains("could not copy")
    {
        "Este vídeo exige login. Entre na conta no Chrome, Edge, Firefox ou outro navegador neste computador e tente de novo.".into()
    } else if lower.contains("age") {
        "Este vídeo exige login ou confirmação de idade. Entre na conta no navegador e tente de novo.".into()
    } else if lower.contains("unsupported url") || lower.contains("is not a valid url") {
        "Este link não foi reconhecido. Confira o endereço ou tente outro site.".into()
    } else if detail.trim().is_empty() {
        "Não foi possível ler este vídeo. Confira o link e tente de novo.".into()
    } else {
        let first = detail
            .lines()
            .find(|line| !line.trim().is_empty())
            .unwrap_or(detail);
        format!("Não foi possível ler este vídeo: {}", first.trim())
    }
}
