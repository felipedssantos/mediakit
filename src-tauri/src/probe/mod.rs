use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::types::{MediaInfo, StreamInfo};

pub async fn probe_media(app: &AppHandle, path: &str) -> Result<MediaInfo, String> {
    let sidecar = app
        .shell()
        .sidecar("ffprobe")
        .map_err(|e| format!("FFprobe sidecar indisponível: {e}"))?;

    let output = sidecar
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .output()
        .await
        .map_err(|e| format!("Falha ao executar FFprobe: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Arquivo inválido ou corrompido: {stderr}"));
    }

    let json: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("JSON inválido do FFprobe: {e}"))?;

    parse_probe_json(path, json)
}

fn parse_probe_json(path: &str, json: Value) -> Result<MediaInfo, String> {
    let format = json.get("format").cloned().unwrap_or(Value::Null);
    let duration = format
        .get("duration")
        .and_then(value_as_f64)
        .unwrap_or(0.0);
    let size = format.get("size").and_then(value_as_u64).unwrap_or(0);
    let bit_rate = format.get("bit_rate").and_then(value_as_u64);
    let format_name = format
        .get("format_name")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();

    let streams = json
        .get("streams")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let video = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(Value::as_str) == Some("video"))
        .map(parse_stream);
    let audio = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(Value::as_str) == Some("audio"))
        .map(parse_stream);

    Ok(MediaInfo {
        path: path.to_string(),
        duration,
        size,
        format_name,
        bit_rate,
        video,
        audio,
    })
}

fn parse_stream(value: &Value) -> StreamInfo {
    StreamInfo {
        codec_type: value
            .get("codec_type")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        codec_name: value
            .get("codec_name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        width: value.get("width").and_then(Value::as_u64).map(|v| v as u32),
        height: value
            .get("height")
            .and_then(Value::as_u64)
            .map(|v| v as u32),
        fps: value
            .get("r_frame_rate")
            .and_then(Value::as_str)
            .and_then(parse_frame_rate),
        bit_rate: value.get("bit_rate").and_then(value_as_u64),
    }
}

fn parse_frame_rate(rate: &str) -> Option<f64> {
    let mut parts = rate.split('/');
    let num: f64 = parts.next()?.parse().ok()?;
    let den: f64 = parts.next().unwrap_or("1").parse().ok()?;
    if den == 0.0 {
        return None;
    }
    Some(num / den)
}

fn value_as_f64(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
}

fn value_as_u64(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
}
