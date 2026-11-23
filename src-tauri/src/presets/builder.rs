use std::path::Path;

use crate::types::{EncodeOptions, MediaInfo};

pub fn is_image_preset(preset_id: &str) -> bool {
    preset_id.starts_with("img_")
}

pub fn output_extension(preset_id: &str, format: Option<&str>) -> &'static str {
    if is_image_preset(preset_id) {
        return match image_format_from(preset_id, format) {
            "png" => "png",
            "webp" => "webp",
            "bmp" => "bmp",
            "tiff" => "tiff",
            "gif" => "gif",
            _ => "jpg",
        };
    }
    if preset_id == "extract_audio" {
        return match format.unwrap_or("m4a").to_ascii_lowercase().as_str() {
            "mp3" => "mp3",
            "wav" => "wav",
            "ogg" => "ogg",
            "flac" => "flac",
            _ => "m4a",
        };
    }
    match format.unwrap_or("mp4").to_ascii_lowercase().as_str() {
        "mkv" => "mkv",
        "mov" => "mov",
        "webm" => "webm",
        "avi" => "avi",
        "m4v" => "m4v",
        _ => "mp4",
    }
}

fn image_format_from(preset_id: &str, image_format: Option<&str>) -> &'static str {
    if let Some(format) = image_format {
        return match format.to_ascii_lowercase().as_str() {
            "png" => "png",
            "webp" => "webp",
            "jpg" | "jpeg" => "jpeg",
            "bmp" => "bmp",
            "tif" | "tiff" => "tiff",
            "gif" => "gif",
            _ => default_image_format(preset_id),
        };
    }
    default_image_format(preset_id)
}

fn default_image_format(preset_id: &str) -> &'static str {
    match preset_id {
        "img_convert_png" => "png",
        "img_compress_web" | "img_convert_webp" => "webp",
        _ => "jpeg",
    }
}

pub fn build_args(
    input: &str,
    output: &str,
    options: &EncodeOptions,
    media: Option<&MediaInfo>,
) -> Result<Vec<String>, String> {
    let mut args = vec![
        "-hide_banner".into(),
        "-y".into(),
        "-i".into(),
        input.into(),
    ];

    match options.preset_id.as_str() {
        "convert_mp4" => append_convert_video(&mut args, options, media),
        "extract_audio" => append_extract_audio(&mut args, options),
        "compress_quality" => append_compress(&mut args, options, "hevc", 23),
        "gpu_nvenc" => append_compress(&mut args, options, "h264", 28),
        "compress_web" => append_compress(&mut args, options, "h264", 28),
        id if is_image_preset(id) => append_image(&mut args, options),
        other => return Err(format!("Preset desconhecido: {other}")),
    }

    args.extend([
        "-progress".into(),
        "pipe:1".into(),
        "-nostats".into(),
        output.into(),
    ]);

    Ok(args)
}

fn append_extract_audio(args: &mut Vec<String>, options: &EncodeOptions) {
    let container = audio_container(options);
    args.push("-vn".into());
    match container {
        "mp3" => args.extend([
            "-c:a".into(),
            "libmp3lame".into(),
            "-b:a".into(),
            options.audio_bitrate.as_deref().unwrap_or("192k").into(),
        ]),
        "wav" => args.extend(["-c:a".into(), "pcm_s16le".into()]),
        "ogg" => args.extend([
            "-c:a".into(),
            "libvorbis".into(),
            "-q:a".into(),
            "5".into(),
        ]),
        "flac" => args.extend(["-c:a".into(), "flac".into()]),
        _ => {
            let codec = options.audio_codec.as_deref().unwrap_or("aac");
            let bitrate = options.audio_bitrate.as_deref().unwrap_or("192k");
            args.extend([
                "-c:a".into(),
                codec.into(),
                "-b:a".into(),
                bitrate.into(),
            ]);
        }
    }
}

fn video_container(options: &EncodeOptions) -> &'static str {
    match options
        .container
        .as_deref()
        .unwrap_or("mp4")
        .to_ascii_lowercase()
        .as_str()
    {
        "mkv" => "mkv",
        "mov" => "mov",
        "webm" => "webm",
        "avi" => "avi",
        "m4v" => "m4v",
        _ => "mp4",
    }
}

fn audio_container(options: &EncodeOptions) -> &'static str {
    match options
        .container
        .as_deref()
        .unwrap_or("m4a")
        .to_ascii_lowercase()
        .as_str()
    {
        "mp3" => "mp3",
        "wav" => "wav",
        "ogg" => "ogg",
        "flac" => "flac",
        _ => "m4a",
    }
}

fn can_copy_streams(container: &str, options: &EncodeOptions, media: Option<&MediaInfo>) -> bool {
    if options.resolution.is_some() || options.use_gpu == Some(true) {
        return false;
    }
    let Some(info) = media else {
        return false;
    };
    let video = info.video.as_ref().map(|v| v.codec_name.as_str());
    let audio = info.audio.as_ref().map(|a| a.codec_name.as_str());
    let video_ok = match (container, video) {
        ("mp4" | "mov" | "m4v", Some("h264" | "hevc" | "mpeg4")) => true,
        ("mkv", Some("h264" | "hevc" | "mpeg4" | "vp8" | "vp9" | "av1")) => true,
        ("webm", Some("vp8" | "vp9" | "av1")) => true,
        ("avi", Some("mpeg4" | "msmpeg4v3" | "h264")) => true,
        _ => false,
    };
    let audio_ok = match (container, audio) {
        (_, None) => true,
        ("mp4" | "mov" | "m4v", Some("aac")) => true,
        ("mkv", Some("aac" | "mp3" | "opus" | "vorbis" | "ac3" | "flac" | "pcm_s16le")) => true,
        ("webm", Some("opus" | "vorbis")) => true,
        ("avi", Some("mp3" | "mp2" | "pcm_s16le")) => true,
        _ => false,
    };
    video_ok && audio_ok
}

fn append_convert_video(args: &mut Vec<String>, options: &EncodeOptions, media: Option<&MediaInfo>) {
    let container = video_container(options);
    if can_copy_streams(container, options, media) {
        args.extend(["-c".into(), "copy".into()]);
        append_container_flags(args, container);
        return;
    }

    match container {
        "webm" => append_webm(args, options),
        "avi" => append_avi(args, options),
        _ => append_compress(args, options, "h264", 18),
    }
}

fn append_webm(args: &mut Vec<String>, options: &EncodeOptions) {
    let crf = options.crf.unwrap_or(32);
    args.extend([
        "-c:v".into(),
        "libvpx-vp9".into(),
        "-crf".into(),
        crf.to_string(),
        "-b:v".into(),
        "0".into(),
        "-c:a".into(),
        "libopus".into(),
        "-b:a".into(),
        options.audio_bitrate.as_deref().unwrap_or("128k").into(),
    ]);
    if let Some(scale) = scale_filter(options.resolution.as_deref()) {
        args.extend(["-vf".into(), scale]);
    }
}

fn append_avi(args: &mut Vec<String>, options: &EncodeOptions) {
    args.extend([
        "-c:v".into(),
        "mpeg4".into(),
        "-q:v".into(),
        "5".into(),
        "-c:a".into(),
        "libmp3lame".into(),
        "-b:a".into(),
        options.audio_bitrate.as_deref().unwrap_or("192k").into(),
    ]);
    if let Some(scale) = scale_filter(options.resolution.as_deref()) {
        args.extend(["-vf".into(), scale]);
    }
}

fn append_container_flags(args: &mut Vec<String>, container: &str) {
    if matches!(container, "mp4" | "mov" | "m4v") {
        args.extend(["-movflags".into(), "+faststart".into()]);
    }
}

fn append_compress(args: &mut Vec<String>, options: &EncodeOptions, default_codec: &str, default_crf: u32) {
    let use_gpu = options.use_gpu.unwrap_or(options.preset_id == "gpu_nvenc");
    let requested = options
        .video_codec
        .as_deref()
        .unwrap_or(default_codec);
    let crf = options.crf.unwrap_or(default_crf);

    if use_gpu || requested.contains("nvenc") {
        let nvenc = match requested {
            "hevc" | "h265" | "hevc_nvenc" => "hevc_nvenc",
            _ => "h264_nvenc",
        };
        args.extend([
            "-c:v".into(),
            nvenc.into(),
            "-preset".into(),
            "p4".into(),
            "-rc".into(),
            "vbr".into(),
            "-cq".into(),
            crf.to_string(),
            "-b:v".into(),
            "0".into(),
        ]);
    } else {
        let (codec, tag_hvc1) = match requested {
            "hevc" | "h265" | "libx265" => ("libx265", true),
            _ => ("libx264", false),
        };
        args.extend([
            "-c:v".into(),
            codec.into(),
            "-preset".into(),
            "medium".into(),
            "-crf".into(),
            crf.to_string(),
        ]);
        if tag_hvc1 {
            args.extend(["-tag:v".into(), "hvc1".into()]);
        }
    }

    if let Some(scale) = scale_filter(options.resolution.as_deref()) {
        args.extend(["-vf".into(), scale]);
    }

    let audio_codec = options.audio_codec.as_deref().unwrap_or("aac");
    let audio_bitrate = options.audio_bitrate.as_deref().unwrap_or("128k");
    args.extend([
        "-c:a".into(),
        audio_codec.into(),
        "-b:a".into(),
        audio_bitrate.into(),
    ]);
    append_container_flags(args, video_container(options));
}

fn append_image(args: &mut Vec<String>, options: &EncodeOptions) {
    args.push("-an".into());

    if let Some(scale) = image_scale_filter(options.resolution.as_deref()) {
        args.extend(["-vf".into(), scale]);
    }

    args.extend(["-frames:v".into(), "1".into()]);

    let format = image_format_from(&options.preset_id, options.image_format.as_deref());
    let quality = options.quality.unwrap_or(match options.preset_id.as_str() {
        "img_compress_web" => 75,
        "img_compress_quality" => 90,
        "img_convert_webp" => 80,
        _ => 85,
    });

    match format {
        "png" => {
            args.extend([
                "-c:v".into(),
                "png".into(),
                "-compression_level".into(),
                "6".into(),
            ]);
        }
        "bmp" => args.extend(["-c:v".into(), "bmp".into()]),
        "tiff" => args.extend(["-c:v".into(), "tiff".into()]),
        "gif" => args.extend(["-c:v".into(), "gif".into()]),
        "webp" => {
            args.extend([
                "-c:v".into(),
                "libwebp".into(),
                "-quality".into(),
                quality.clamp(1, 100).to_string(),
                "-compression_level".into(),
                "4".into(),
            ]);
        }
        _ => {
            args.extend([
                "-c:v".into(),
                "mjpeg".into(),
                "-q:v".into(),
                jpeg_q(quality).to_string(),
            ]);
        }
    }
}

fn jpeg_q(quality: u32) -> u32 {
    let mapped = 31.0 - (quality.clamp(1, 100) as f32 / 100.0) * 29.0;
    mapped.round().clamp(2.0, 31.0) as u32
}

fn image_scale_filter(resolution: Option<&str>) -> Option<String> {
    let max_edge = match resolution? {
        "original" | "" => return None,
        "1920" | "1080p" => 1920,
        "1280" | "720p" => 1280,
        "800" | "480p" => 800,
        other => other.parse().ok()?,
    };
    Some(format!(
        "scale='min(iw,{max_edge})':'min(ih,{max_edge})':force_original_aspect_ratio=decrease"
    ))
}

fn scale_filter(resolution: Option<&str>) -> Option<String> {
    let height = match resolution? {
        "1080p" => 1080,
        "720p" => 720,
        "480p" => 480,
        "original" | "" => return None,
        other if other.contains('x') => {
            return Some(format!(
                "scale={}:force_original_aspect_ratio=decrease",
                other.replace('x', ":")
            ));
        }
        _ => return None,
    };
    Some(format!("scale=-2:{height}"))
}

pub fn default_output_path(
    input: &str,
    preset_id: &str,
    output_dir: Option<&str>,
    image_format: Option<&str>,
) -> String {
    let path = Path::new(input);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let parent = output_dir
        .map(Path::new)
        .or_else(|| path.parent())
        .unwrap_or(Path::new("."));
    let ext = output_extension(preset_id, image_format);
    parent
        .join(format!("{stem}_{preset_id}.{ext}"))
        .to_string_lossy()
        .into_owned()
}

#[cfg(test)]
mod tests {
    use super::{build_args, jpeg_q, output_extension};
    use crate::types::EncodeOptions;

    fn options(preset_id: &str, quality: Option<u32>, format: Option<&str>) -> EncodeOptions {
        EncodeOptions {
            preset_id: preset_id.into(),
            crf: None,
            video_codec: None,
            audio_codec: None,
            audio_bitrate: None,
            resolution: None,
            use_gpu: None,
            quality,
            image_format: format.map(str::to_string),
            container: None,
        }
    }

    #[test]
    fn image_jpeg_uses_mjpeg_and_qscale() {
        let args = build_args(
            "in.png",
            "out.jpg",
            &options("img_convert_jpeg", Some(85), None),
            None,
        )
        .unwrap();
        assert!(args.contains(&"-frames:v".into()));
        assert!(args.contains(&"mjpeg".into()));
        assert!(args.contains(&jpeg_q(85).to_string()));
        assert_eq!(output_extension("img_convert_jpeg", None), "jpg");
    }

    #[test]
    fn image_webp_uses_libwebp() {
        let args = build_args(
            "in.jpg",
            "out.webp",
            &options("img_compress_web", Some(75), None),
            None,
        )
        .unwrap();
        assert!(args.contains(&"libwebp".into()));
        assert!(args.contains(&"75".into()));
        assert_eq!(output_extension("img_compress_web", None), "webp");
    }

    #[test]
    fn image_format_override_changes_extension() {
        assert_eq!(output_extension("img_compress_web", Some("png")), "png");
        assert_eq!(output_extension("img_convert_png", Some("jpeg")), "jpg");
    }

    #[test]
    fn video_container_changes_extension() {
        assert_eq!(output_extension("convert_mp4", Some("mkv")), "mkv");
        assert_eq!(output_extension("convert_mp4", Some("webm")), "webm");
        assert_eq!(output_extension("extract_audio", Some("mp3")), "mp3");
        assert_eq!(output_extension("compress_web", None), "mp4");
    }

    #[test]
    fn convert_webm_uses_vp9() {
        let mut opts = options("convert_mp4", None, None);
        opts.container = Some("webm".into());
        let args = build_args("in.mkv", "out.webm", &opts, None).unwrap();
        assert!(args.contains(&"libvpx-vp9".into()));
        assert!(args.contains(&"libopus".into()));
    }
}
