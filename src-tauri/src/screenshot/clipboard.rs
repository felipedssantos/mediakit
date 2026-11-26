#[cfg(not(windows))]
use arboard::{Clipboard, ImageData};
use tauri::AppHandle;

use crate::error::{AppError, AppResult};

fn write_dib_header(buf: &mut [u8], width: u32, height: i32, pixel_bytes: usize) {
    buf[0..4].copy_from_slice(&40u32.to_le_bytes());
    buf[4..8].copy_from_slice(&(width as i32).to_le_bytes());
    buf[8..12].copy_from_slice(&height.to_le_bytes());
    buf[12..14].copy_from_slice(&1u16.to_le_bytes());
    buf[14..16].copy_from_slice(&32u16.to_le_bytes());
    buf[20..24].copy_from_slice(&(pixel_bytes as u32).to_le_bytes());
}

fn copy_rgba_to_bgra_opaque(src: &[u8], dst: &mut [u8]) {
    for (src_px, dst_px) in src
        .as_chunks::<4>()
        .0
        .iter()
        .zip(dst.as_chunks_mut::<4>().0.iter_mut())
    {
        dst_px[0] = src_px[2];
        dst_px[1] = src_px[1];
        dst_px[2] = src_px[0];
        dst_px[3] = 255;
    }
}

/// Converts RGBA pixels to a bottom-up 32-bit CF_DIB payload with opaque alpha
/// for maximum compatibility across Windows clipboard consumers.
pub fn rgba_to_dib(image: &image::RgbaImage) -> Vec<u8> {
    let width = image.width() as usize;
    let height = image.height() as usize;
    let row_bytes = width.saturating_mul(4);
    let pixel_bytes = row_bytes.saturating_mul(height);
    let mut dib = vec![0u8; 40 + pixel_bytes];
    write_dib_header(&mut dib[0..40], width as u32, height as i32, pixel_bytes);

    let src = image.as_raw();
    let dst = &mut dib[40..];
    for y in 0..height {
        let src_row = &src[y * row_bytes..(y + 1) * row_bytes];
        let dst_row = &mut dst[(height - 1 - y) * row_bytes..(height - y) * row_bytes];
        copy_rgba_to_bgra_opaque(src_row, dst_row);
    }
    dib
}

/// Encodes RGBA pixels into an uncompressed top-down 32-bit BMP for the `snip://`
/// custom protocol without disk writes or lossy compression.
pub fn rgba_to_bmp(image: &image::RgbaImage) -> Vec<u8> {
    let width = image.width();
    let height = image.height();
    let pixel_bytes = (width as usize)
        .saturating_mul(height as usize)
        .saturating_mul(4);
    let total_size = 54 + pixel_bytes;
    let mut bmp = vec![0u8; total_size];
    bmp[0..2].copy_from_slice(b"BM");
    bmp[2..6].copy_from_slice(&(total_size as u32).to_le_bytes());
    bmp[10..14].copy_from_slice(&54u32.to_le_bytes());
    write_dib_header(&mut bmp[14..54], width, -(height as i32), pixel_bytes);

    copy_rgba_to_bgra_opaque(image.as_raw(), &mut bmp[54..]);
    bmp
}

#[cfg(windows)]
fn set_clipboard_image_bytes(dib: &[u8]) -> AppResult<()> {
    let _clip =
        clipboard_win::Clipboard::new_attempts(10).map_err(|e| AppError::message(e.to_string()))?;
    clipboard_win::raw::set(clipboard_win::formats::CF_DIB, dib)
        .map_err(|e| AppError::message(e.to_string()))
}

#[cfg(not(windows))]
fn copy_rgba(image: &image::RgbaImage) -> AppResult<()> {
    let (width, height) = image.dimensions();
    let mut clipboard = Clipboard::new().map_err(|e| AppError::message(e.to_string()))?;
    clipboard
        .set_image(ImageData {
            width: width as usize,
            height: height as usize,
            bytes: image.as_raw().clone().into(),
        })
        .map_err(|e| AppError::message(e.to_string()))
}

pub fn copy_dib_on_main(app: &AppHandle, dib: Vec<u8>) -> AppResult<()> {
    #[cfg(windows)]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(set_clipboard_image_bytes(&dib));
        })
        .map_err(|e| AppError::message(e.to_string()))?;
        rx.recv().map_err(|_| {
            AppError::message("Não foi possível copiar para a área de transferência")
        })?
    }
    #[cfg(not(windows))]
    {
        let _ = (app, dib);
        Err(AppError::message(
            "Cópia de print não suportada nesta plataforma",
        ))
    }
}

pub fn copy_rgba_on_main(app: &AppHandle, image: &image::RgbaImage) -> AppResult<()> {
    #[cfg(windows)]
    {
        let dib = rgba_to_dib(image);
        copy_dib_on_main(app, dib)
    }
    #[cfg(not(windows))]
    {
        let image = image.clone();
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(copy_rgba(&image));
        })
        .map_err(|e| AppError::message(e.to_string()))?;
        rx.recv().map_err(|_| {
            AppError::message("Não foi possível copiar para a área de transferência")
        })?
    }
}

#[cfg(test)]
mod tests {
    use super::{rgba_to_bmp, rgba_to_dib};
    use image::{Rgba, RgbaImage};

    #[test]
    fn dib_is_bottom_up_with_opaque_alpha() {
        let mut img = RgbaImage::new(2, 2);
        img.put_pixel(0, 0, Rgba([10, 20, 30, 0])); // top-left
        img.put_pixel(0, 1, Rgba([40, 50, 60, 128])); // bottom-left

        let dib = rgba_to_dib(&img);
        assert_eq!(dib.len(), 40 + 16);
        assert_eq!(i32::from_le_bytes(dib[8..12].try_into().unwrap()), 2);
        // Bottom row comes first in bottom-up DIB: BGRA(60, 50, 40, 255)
        assert_eq!(&dib[40..44], &[60, 50, 40, 255]);
        // Top row comes last: BGRA(30, 20, 10, 255)
        assert_eq!(&dib[48..52], &[30, 20, 10, 255]);
    }

    #[test]
    fn bmp_has_valid_header_and_top_down_pixels() {
        let mut img = RgbaImage::new(1, 2);
        img.put_pixel(0, 0, Rgba([200, 100, 50, 255]));
        img.put_pixel(0, 1, Rgba([1, 2, 3, 255]));

        let bmp = rgba_to_bmp(&img);
        assert_eq!(&bmp[0..2], b"BM");
        assert_eq!(bmp.len(), 54 + 8);
        assert_eq!(i32::from_le_bytes(bmp[22..26].try_into().unwrap()), -2);
        assert_eq!(&bmp[54..58], &[50, 100, 200, 255]);
        assert_eq!(&bmp[58..62], &[3, 2, 1, 255]);
    }
}
