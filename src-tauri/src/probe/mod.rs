use serde_json::Value;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::sidecar::run_output;
use crate::types::{MediaInfo, StreamInfo};

pub async fn probe_media(app: &AppHandle, path: &str) -> AppResult<MediaInfo> {
    let args = vec![
        "-v".into(),
        "quiet".into(),
        "-print_format".into(),
        "json".into(),
        "-show_format".into(),
        "-show_streams".into(),
        path.into(),
    ];
    let output = run_output(app, "ffprobe", &args).await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::message(format!(
            "Arquivo inválido ou corrompido: {stderr}"
        )));
    }

    let json: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::message(format!("JSON inválido do FFprobe: {e}")))?;

    Ok(parse_probe_json(path, json))
}

pub fn parse_probe_json(path: &str, json: Value) -> MediaInfo {
    let format = json.get("format").cloned().unwrap_or(Value::Null);
    let duration = format.get("duration").and_then(value_as_f64).unwrap_or(0.0);
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

    MediaInfo {
        path: path.to_string(),
        duration,
        size,
        format_name,
        bit_rate,
        video,
        audio,
    }
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{parse_frame_rate, parse_probe_json};

    #[test]
    fn parses_video_and_audio_streams_from_ffprobe_json() {
        let raw = json!({
            "format": {
                "duration": "125.5",
                "size": "1048576",
                "bit_rate": "668000",
                "format_name": "mov,mp4,m4a"
            },
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "h264",
                    "width": 1920,
                    "height": 1080,
                    "r_frame_rate": "30000/1001",
                    "bit_rate": "500000"
                },
                {
                    "codec_type": "audio",
                    "codec_name": "aac",
                    "bit_rate": "128000"
                }
            ]
        });

        let info = parse_probe_json("clip.mp4", raw);
        assert_eq!(info.duration, 125.5);
        assert_eq!(info.size, 1_048_576);
        assert_eq!(info.format_name, "mov,mp4,m4a");
        let video = info.video.unwrap();
        assert_eq!(video.codec_name, "h264");
        assert_eq!(video.width, Some(1920));
        assert!((video.fps.unwrap() - 29.97).abs() < 0.01);
        assert_eq!(info.audio.unwrap().codec_name, "aac");
    }

    #[test]
    fn handles_missing_fields_and_zero_denominator_fps() {
        assert!(parse_frame_rate("30/0").is_none());
        let info = parse_probe_json("empty.bin", json!({}));
        assert_eq!(info.duration, 0.0);
        assert_eq!(info.format_name, "unknown");
        assert!(info.video.is_none());
        assert!(info.audio.is_none());
    }
}
