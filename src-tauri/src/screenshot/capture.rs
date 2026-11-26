use std::fs;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{ExtendedColorType, ImageEncoder};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use xcap::Monitor;

use crate::error::{AppError, AppResult};
use crate::screenshot::region::overlay_label_for;
use crate::screenshot::ScreenshotHistoryItem;

const HISTORY_LIMIT: usize = 100;

pub struct MonitorShot {
    pub overlay_label: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub image: image::RgbaImage,
}

pub fn save_png(image: &image::RgbaImage, path: &Path) -> AppResult<()> {
    let file = fs::File::create(path)?;
    let encoder = PngEncoder::new_with_quality(
        BufWriter::new(file),
        CompressionType::Fast,
        FilterType::NoFilter,
    );
    encoder
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ExtendedColorType::Rgba8,
        )
        .map_err(|err| AppError::message(err.to_string()))
}

pub fn crop_rgba(
    image: &image::RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> AppResult<image::RgbaImage> {
    if width == 0 || height == 0 {
        return Err(AppError::validation("Selecione uma área maior"));
    }
    let img_w = image.width();
    let img_h = image.height();
    let x = x.min(img_w.saturating_sub(1));
    let y = y.min(img_h.saturating_sub(1));
    let width = width.min(img_w.saturating_sub(x)).max(1);
    let height = height.min(img_h.saturating_sub(y)).max(1);
    Ok(image::imageops::crop_imm(image, x, y, width, height).to_image())
}

pub fn sorted_monitors() -> AppResult<Vec<Monitor>> {
    let mut monitors = Monitor::all().map_err(|e| AppError::message(e.to_string()))?;
    monitors.sort_by(|a, b| {
        b.is_primary()
            .unwrap_or(false)
            .cmp(&a.is_primary().unwrap_or(false))
            .then(a.id().unwrap_or(0).cmp(&b.id().unwrap_or(0)))
    });
    if monitors.is_empty() {
        return Err(AppError::NotFound("Nenhum monitor encontrado"));
    }
    Ok(monitors)
}

fn capture_monitor_at(index: usize, monitor: xcap::Monitor) -> AppResult<MonitorShot> {
    let monitor_id = monitor.id().unwrap_or(index as u32);
    let x = monitor.x().unwrap_or(0);
    let y = monitor.y().unwrap_or(0);
    let width = monitor
        .width()
        .map_err(|e| AppError::message(e.to_string()))?;
    let height = monitor
        .height()
        .map_err(|e| AppError::message(e.to_string()))?;
    let image = monitor
        .capture_image()
        .map_err(|e| AppError::message(e.to_string()))?;
    Ok(MonitorShot {
        overlay_label: overlay_label_for(index, monitor_id),
        x,
        y,
        width,
        height,
        image,
    })
}

pub fn capture_all_monitors() -> AppResult<Vec<MonitorShot>> {
    let monitors = sorted_monitors()?;
    if monitors.len() == 1 {
        let monitor = monitors.into_iter().next().unwrap();
        return Ok(vec![capture_monitor_at(0, monitor)?]);
    }
    let count = monitors.len();
    drop(monitors);
    let results: Vec<AppResult<MonitorShot>> = std::thread::scope(|scope| {
        let handles: Vec<_> = (0..count)
            .map(|index| {
                scope.spawn(move || {
                    let monitor = sorted_monitors()?
                        .into_iter()
                        .nth(index)
                        .ok_or(AppError::NotFound("Monitor não encontrado"))?;
                    capture_monitor_at(index, monitor)
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|handle| {
                handle
                    .join()
                    .unwrap_or_else(|_| Err(AppError::message("Falha na captura do monitor")))
            })
            .collect()
    });
    results.into_iter().collect()
}

pub fn history_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| AppError::message(e.to_string()))?
        .join("screenshots");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn history_index_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(history_dir(app)?.join("index.json"))
}

pub fn read_history_index(app: &AppHandle) -> Vec<ScreenshotHistoryItem> {
    let Ok(path) = history_index_path(app) else {
        return Vec::new();
    };
    let Ok(bytes) = fs::read(&path) else {
        return Vec::new();
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

pub fn write_history_index(app: &AppHandle, items: &[ScreenshotHistoryItem]) -> AppResult<()> {
    let path = history_index_path(app)?;
    let bytes = serde_json::to_vec_pretty(items).map_err(|e| AppError::message(e.to_string()))?;
    fs::write(path, bytes)?;
    Ok(())
}

pub fn prune_history(items: Vec<ScreenshotHistoryItem>) -> Vec<ScreenshotHistoryItem> {
    let mut kept = Vec::new();
    for item in items {
        if !Path::new(&item.path).is_file() {
            continue;
        }
        if kept.len() < HISTORY_LIMIT {
            kept.push(item);
        } else {
            let _ = fs::remove_file(&item.path);
        }
    }
    kept
}

pub fn archive_screenshot(
    app: &AppHandle,
    image: &image::RgbaImage,
    action: &str,
) -> AppResult<ScreenshotHistoryItem> {
    let id = Uuid::new_v4().to_string();
    let path = history_dir(app)?.join(format!("{id}.png"));
    save_png(image, &path)?;
    let item = ScreenshotHistoryItem {
        id,
        path: path.to_string_lossy().into_owned(),
        width: image.width(),
        height: image.height(),
        created_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or(0),
        action: action.to_string(),
    };
    let mut items = read_history_index(app);
    items.insert(0, item.clone());
    let items = prune_history(items);
    write_history_index(app, &items)?;
    Ok(item)
}
