/// Parses FFmpeg `-progress pipe:1` output into a 0.0..=99.9 percentage.
pub fn parse_ffmpeg_progress(line: &str, duration: f64) -> Option<f32> {
    let line = line.trim();
    let seconds = parse_out_time_seconds(line)?;
    if duration <= 0.05 {
        return None;
    }
    Some(((seconds / duration) * 100.0).clamp(0.0, 99.9) as f32)
}

/// FFmpeg `-progress` prints `out_time_ms` with a microsecond value (legacy name).
/// Prefer `out_time_us` / `out_time=` and never scale `out_time_ms` as milliseconds.
pub fn parse_out_time_seconds(line: &str) -> Option<f64> {
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

pub fn parse_ffmpeg_speed(line: &str) -> Option<String> {
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

pub fn parse_ytdlp_progress(line: &str) -> Option<f32> {
    let line = line.trim();
    if !line.contains("[download]") || !line.contains('%') || line.contains("Destination") {
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

pub fn parse_ytdlp_speed(line: &str) -> Option<String> {
    let marker = " at ";
    let idx = line.find(marker)?;
    let rest = &line[idx + marker.len()..];
    let speed = rest.split_whitespace().next()?;
    if speed == "Unknown" || speed.is_empty() {
        return None;
    }
    Some(speed.to_string())
}

pub fn parse_ytdlp_destination(line: &str) -> Option<String> {
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

pub fn is_ytdlp_postprocess_line(line: &str) -> bool {
    line.contains("[Merger]")
        || line.contains("[ExtractAudio]")
        || line.contains("[Fixup")
        || line.contains("Deleting original file")
        || line.contains("has already been downloaded")
}

pub fn overall_ytdlp_progress(part: u32, expected_parts: u32, part_percent: f32) -> f32 {
    let current = part.max(1);
    let parts = expected_parts.max(current).max(1) as f32;
    let index = (current - 1) as f32;
    ((index + (part_percent / 100.0).clamp(0.0, 1.0)) / parts * 99.0).clamp(0.0, 99.4)
}

#[cfg(test)]
mod tests {
    use super::{
        is_ytdlp_postprocess_line, overall_ytdlp_progress, parse_ffmpeg_progress,
        parse_ffmpeg_speed, parse_out_time_seconds, parse_ytdlp_destination, parse_ytdlp_progress,
        parse_ytdlp_speed,
    };

    #[test]
    fn out_time_ms_is_microseconds() {
        assert_eq!(parse_out_time_seconds("out_time_ms=5000000").unwrap(), 5.0);
        let progress = parse_ffmpeg_progress("out_time_ms=5000000", 50.0).unwrap();
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

    #[test]
    fn ignores_na_and_still_images() {
        assert!(parse_out_time_seconds("out_time_us=N/A").is_none());
        assert!(parse_ffmpeg_progress("out_time_us=1000", 0.01).is_none());
    }

    #[test]
    fn parses_ffmpeg_speed_value() {
        assert_eq!(
            parse_ffmpeg_speed("frame=120 speed=2.45x "),
            Some("2.45x".to_string())
        );
        assert_eq!(parse_ffmpeg_speed("speed=N/A"), None);
    }

    #[test]
    fn parses_ytdlp_percent_and_speed() {
        let line = "[download]  12.4% of  40.00MiB at  1.10MiB/s ETA 00:25";
        let value = parse_ytdlp_progress(line).unwrap();
        assert!((value - 12.4).abs() < 0.01);
        assert_eq!(parse_ytdlp_speed(line).unwrap(), "1.10MiB/s");
        assert!(parse_ytdlp_progress("[download] Destination: out.mp4").is_none());
        assert!(parse_ytdlp_speed("[download] 10% of ~40MiB at Unknown ETA").is_none());
    }

    #[test]
    fn maps_two_part_ytdlp_download() {
        let video_done = overall_ytdlp_progress(1, 2, 100.0);
        let audio_half = overall_ytdlp_progress(2, 2, 50.0);
        assert!((video_done - 49.5).abs() < 0.1);
        assert!((audio_half - 74.25).abs() < 0.1);
        assert!(audio_half > video_done);
    }

    #[test]
    fn parses_ytdlp_destinations_and_postprocess() {
        assert_eq!(
            parse_ytdlp_destination("[download] Destination: C:\\out\\video.mp4").as_deref(),
            Some("C:\\out\\video.mp4")
        );
        assert_eq!(
            parse_ytdlp_destination("[Merger] Merging formats into \"C:\\out\\final.mp4\"")
                .as_deref(),
            Some("C:\\out\\final.mp4")
        );
        assert_eq!(
            parse_ytdlp_destination("[ExtractAudio] Destination: C:\\out\\audio.m4a").as_deref(),
            Some("C:\\out\\audio.m4a")
        );
        assert!(is_ytdlp_postprocess_line(
            "[Merger] Merging formats into \"x\""
        ));
        assert!(!is_ytdlp_postprocess_line("[download] 12.4% of 40MiB"));
    }
}
