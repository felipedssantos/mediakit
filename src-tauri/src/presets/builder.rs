use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::presets::image::{append_image, image_format_from, is_image_preset};
use crate::presets::video::{append_compress, append_convert_video, append_extract_audio};
use crate::types::{EncodeOptions, GpuVendor, MediaInfo};

/// Resolves the output file extension for a given preset and optional container/format override.
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

/// Builds the full FFmpeg CLI argument list for a video, audio, or image conversion job.
pub fn build_args(
    input: &str,
    output: &str,
    options: &EncodeOptions,
    media: Option<&MediaInfo>,
    gpu_vendor: Option<GpuVendor>,
) -> AppResult<Vec<String>> {
    let mut args = vec!["-hide_banner".into(), "-y".into()];
    let wants_gpu = options.use_gpu.unwrap_or(options.preset_id == "gpu_nvenc");
    if wants_gpu && gpu_vendor == Some(GpuVendor::Vaapi) && !is_image_preset(&options.preset_id) {
        args.extend(["-vaapi_device".into(), "/dev/dri/renderD128".into()]);
    }
    args.extend(["-i".into(), input.into()]);

    match options.preset_id.as_str() {
        "convert_mp4" => append_convert_video(&mut args, options, media, gpu_vendor),
        "extract_audio" => append_extract_audio(&mut args, options),
        "compress_quality" => append_compress(&mut args, options, "hevc", 23, gpu_vendor),
        "gpu_nvenc" => append_compress(&mut args, options, "h264", 28, gpu_vendor),
        "compress_web" => append_compress(&mut args, options, "h264", 28, gpu_vendor),
        id if is_image_preset(id) => append_image(&mut args, options),
        other => {
            return Err(AppError::validation(format!(
                "Preset desconhecido: {other}"
            )))
        }
    }

    args.extend([
        "-progress".into(),
        "pipe:1".into(),
        "-nostats".into(),
        output.into(),
    ]);

    Ok(args)
}

/// Suggests a default output path using the input stem, preset ID, and target directory.
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
    use super::{build_args, output_extension};
    use crate::presets::image::jpeg_q;
    use crate::types::{EncodeOptions, GpuVendor};

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
        let args = build_args("in.mkv", "out.webm", &opts, None, None).unwrap();
        assert!(args.contains(&"libvpx-vp9".into()));
        assert!(args.contains(&"libopus".into()));
    }

    #[test]
    fn gpu_encoders_map_per_vendor() {
        let mut opts = options("compress_web", None, None);
        opts.use_gpu = Some(true);

        let nv = build_args("in.mp4", "out.mp4", &opts, None, Some(GpuVendor::Nvidia)).unwrap();
        assert!(nv.contains(&"h264_nvenc".into()));

        let amd = build_args("in.mp4", "out.mp4", &opts, None, Some(GpuVendor::Amd)).unwrap();
        assert!(amd.contains(&"h264_amf".into()));

        let intel = build_args("in.mp4", "out.mp4", &opts, None, Some(GpuVendor::Intel)).unwrap();
        assert!(intel.contains(&"h264_qsv".into()));

        let apple = build_args("in.mp4", "out.mp4", &opts, None, Some(GpuVendor::Apple)).unwrap();
        assert!(apple.contains(&"h264_videotoolbox".into()));

        let vaapi = build_args("in.mp4", "out.mp4", &opts, None, Some(GpuVendor::Vaapi)).unwrap();
        assert!(vaapi.contains(&"h264_vaapi".into()));
        assert!(vaapi.contains(&"-vaapi_device".into()));

        opts.video_codec = Some("hevc".into());
        let amd_hevc = build_args("in.mp4", "out.mp4", &opts, None, Some(GpuVendor::Amd)).unwrap();
        assert!(amd_hevc.contains(&"hevc_amf".into()));

        opts.use_gpu = Some(false);
        let cpu = build_args("in.mp4", "out.mp4", &opts, None, Some(GpuVendor::Amd)).unwrap();
        assert!(cpu.contains(&"libx265".into()));
    }
}
