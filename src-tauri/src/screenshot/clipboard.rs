#[cfg(not(windows))]
use arboard::{Clipboard, ImageData};
use tauri::AppHandle;

use crate::error::{AppError, AppResult};

pub fn rgba_to_dib(image: &image::RgbaImage) -> Vec<u8> {
    let width = image.width();
    let height = image.height();
    let pixel_bytes = (width as usize)
        .saturating_mul(height as usize)
        .saturating_mul(4);
    let mut dib = vec![0u8; 40 + pixel_bytes];
    dib[0..4].copy_from_slice(&40u32.to_le_bytes());
    dib[4..8].copy_from_slice(&(width as i32).to_le_bytes());
    dib[8..12].copy_from_slice(&(-(height as i32)).to_le_bytes());
    dib[12..14].copy_from_slice(&1u16.to_le_bytes());
    dib[14..16].copy_from_slice(&32u16.to_le_bytes());
    dib[20..24].copy_from_slice(&(pixel_bytes as u32).to_le_bytes());
    let src = image.as_raw();
    let dst = &mut dib[40..];
    for (index, pixel) in src.as_chunks::<4>().0.iter().enumerate() {
        let offset = index * 4;
        dst[offset] = pixel[2];
        dst[offset + 1] = pixel[1];
        dst[offset + 2] = pixel[0];
        dst[offset + 3] = pixel[3];
    }
    dib
}

#[cfg(windows)]
fn set_clipboard_image_bytes(dib: &[u8]) -> AppResult<()> {
    let _clip =
        clipboard_win::Clipboard::new_attempts(10).map_err(|e| AppError::message(e.to_string()))?;
    clipboard_win::raw::set(clipboard_win::formats::CF_DIB, dib)
        .map_err(|e| AppError::message(e.to_string()))
}

#[cfg(not(windows))]
fn set_clipboard_image_bytes(dib: &[u8]) -> AppResult<()> {
    let _ = dib;
    Err(AppError::message(
        "Cópia de print não suportada nesta plataforma",
    ))
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
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(set_clipboard_image_bytes(&dib));
    })
    .map_err(|e| AppError::message(e.to_string()))?;
    rx.recv()
        .map_err(|_| AppError::message("Não foi possível copiar para a área de transferência"))?
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
