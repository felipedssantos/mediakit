use crate::types::EncodeOptions;

pub fn is_image_preset(preset_id: &str) -> bool {
    preset_id.starts_with("img_")
}

pub fn image_format_from(preset_id: &str, image_format: Option<&str>) -> &'static str {
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

pub fn append_image(args: &mut Vec<String>, options: &EncodeOptions) {
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

pub fn jpeg_q(quality: u32) -> u32 {
    let mapped = 31.0 - (quality.clamp(1, 100) as f32 / 100.0) * 29.0;
    mapped.round().clamp(2.0, 31.0) as u32
}

fn default_image_format(preset_id: &str) -> &'static str {
    match preset_id {
        "img_convert_png" => "png",
        "img_compress_web" | "img_convert_webp" => "webp",
        _ => "jpeg",
    }
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
