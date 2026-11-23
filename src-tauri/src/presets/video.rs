use crate::types::{EncodeOptions, GpuVendor, MediaInfo};

pub fn video_container(options: &EncodeOptions) -> &'static str {
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

pub fn audio_container(options: &EncodeOptions) -> &'static str {
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

pub fn append_extract_audio(args: &mut Vec<String>, options: &EncodeOptions) {
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
        "ogg" => args.extend(["-c:a".into(), "libvorbis".into(), "-q:a".into(), "5".into()]),
        "flac" => args.extend(["-c:a".into(), "flac".into()]),
        _ => {
            let codec = options.audio_codec.as_deref().unwrap_or("aac");
            let bitrate = options.audio_bitrate.as_deref().unwrap_or("192k");
            args.extend(["-c:a".into(), codec.into(), "-b:a".into(), bitrate.into()]);
        }
    }
}

pub fn append_convert_video(
    args: &mut Vec<String>,
    options: &EncodeOptions,
    media: Option<&MediaInfo>,
    gpu_vendor: Option<GpuVendor>,
) {
    let container = video_container(options);
    if can_copy_streams(container, options, media) {
        args.extend(["-c".into(), "copy".into()]);
        append_container_flags(args, container);
        return;
    }

    match container {
        "webm" => append_webm(args, options),
        "avi" => append_avi(args, options),
        _ => append_compress(args, options, "h264", 18, gpu_vendor),
    }
}

pub fn append_compress(
    args: &mut Vec<String>,
    options: &EncodeOptions,
    default_codec: &str,
    default_crf: u32,
    gpu_vendor: Option<GpuVendor>,
) {
    let use_gpu = options.use_gpu.unwrap_or(options.preset_id == "gpu_nvenc");
    let requested = options.video_codec.as_deref().unwrap_or(default_codec);
    let crf = options.crf.unwrap_or(default_crf);
    let is_hevc = matches!(requested, "hevc" | "h265" | "hevc_nvenc" | "libx265");

    let active_gpu = if use_gpu {
        gpu_vendor.or_else(|| requested.contains("nvenc").then_some(GpuVendor::Nvidia))
    } else if requested.contains("nvenc") {
        Some(GpuVendor::Nvidia)
    } else {
        None
    };

    let mut vaapi_upload = false;
    match active_gpu {
        Some(GpuVendor::Nvidia) => {
            let encoder = if is_hevc { "hevc_nvenc" } else { "h264_nvenc" };
            args.extend([
                "-c:v".into(),
                encoder.into(),
                "-preset".into(),
                "p4".into(),
                "-rc".into(),
                "vbr".into(),
                "-cq".into(),
                crf.to_string(),
                "-b:v".into(),
                "0".into(),
            ]);
        }
        Some(GpuVendor::Amd) => {
            let encoder = if is_hevc { "hevc_amf" } else { "h264_amf" };
            args.extend([
                "-c:v".into(),
                encoder.into(),
                "-quality".into(),
                "balanced".into(),
                "-rc".into(),
                "cqp".into(),
                "-qp_i".into(),
                crf.to_string(),
                "-qp_p".into(),
                crf.to_string(),
            ]);
        }
        Some(GpuVendor::Intel) => {
            let encoder = if is_hevc { "hevc_qsv" } else { "h264_qsv" };
            args.extend([
                "-c:v".into(),
                encoder.into(),
                "-preset".into(),
                "medium".into(),
                "-global_quality".into(),
                crf.to_string(),
            ]);
        }
        Some(GpuVendor::Apple) => {
            let encoder = if is_hevc {
                "hevc_videotoolbox"
            } else {
                "h264_videotoolbox"
            };
            let q = (100_i32 - (crf as i32 * 2)).clamp(20, 90);
            args.extend(["-c:v".into(), encoder.into(), "-q:v".into(), q.to_string()]);
        }
        Some(GpuVendor::Vaapi) => {
            let encoder = if is_hevc { "hevc_vaapi" } else { "h264_vaapi" };
            vaapi_upload = true;
            args.extend(["-c:v".into(), encoder.into(), "-qp".into(), crf.to_string()]);
        }
        None => {
            let (codec, tag_hvc1) = if is_hevc {
                ("libx265", true)
            } else {
                ("libx264", false)
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
    }

    let vf = match (scale_filter(options.resolution.as_deref()), vaapi_upload) {
        (Some(scale), true) => Some(format!("{scale},format=nv12,hwupload")),
        (Some(scale), false) => Some(scale),
        (None, true) => Some("format=nv12,hwupload".into()),
        (None, false) => None,
    };
    if let Some(filter) = vf {
        args.extend(["-vf".into(), filter]);
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

fn can_copy_streams(container: &str, options: &EncodeOptions, media: Option<&MediaInfo>) -> bool {
    if options.resolution.is_some() || options.use_gpu == Some(true) {
        return false;
    }
    let Some(info) = media else {
        return false;
    };
    let video = info.video.as_ref().map(|v| v.codec_name.as_str());
    let audio = info.audio.as_ref().map(|a| a.codec_name.as_str());
    let video_ok = matches!(
        (container, video),
        ("mp4" | "mov" | "m4v", Some("h264" | "hevc" | "mpeg4"))
            | (
                "mkv",
                Some("h264" | "hevc" | "mpeg4" | "vp8" | "vp9" | "av1")
            )
            | ("webm", Some("vp8" | "vp9" | "av1"))
            | ("avi", Some("mpeg4" | "msmpeg4v3" | "h264"))
    );
    let audio_ok = matches!(
        (container, audio),
        (_, None)
            | ("mp4" | "mov" | "m4v", Some("aac"))
            | (
                "mkv",
                Some("aac" | "mp3" | "opus" | "vorbis" | "ac3" | "flac" | "pcm_s16le")
            )
            | ("webm", Some("opus" | "vorbis"))
            | ("avi", Some("mp3" | "mp2" | "pcm_s16le"))
    );
    video_ok && audio_ok
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
