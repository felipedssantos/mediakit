use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Duration;

use base64::Engine;
use image::GenericImageView;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use uuid::Uuid;
use xcap::{Monitor, Window};

use crate::error::{AppError, AppResult};
use crate::screenshot::capture::{
    archive_screenshot, crop_rgba, prune_history, read_history_index, save_png, save_webp,
    temp_png_path, write_history_index,
};
use crate::screenshot::clipboard::{copy_dib_on_main, copy_rgba_on_main, rgba_to_dib};
use crate::screenshot::region::{
    complete_capture, get_region_session_inner, hide_main, hide_overlays, show_main,
    show_session_overlays, start_snip_overlay,
};
use crate::screenshot::windows::{collect_windows, find_monitor};
use crate::screenshot::{
    RegionSessionDto, ScreenshotCapture, ScreenshotHistoryItem, ScreenshotMonitorInfo,
    ScreenshotState, ScreenshotWindowInfo,
};

#[tauri::command]
pub fn list_screenshot_monitors() -> AppResult<Vec<ScreenshotMonitorInfo>> {
    let mut monitors = Monitor::all()
        .map_err(|e| AppError::message(e.to_string()))?
        .into_iter()
        .filter_map(|monitor| {
            Some(ScreenshotMonitorInfo {
                id: monitor.id().ok()?,
                name: monitor
                    .friendly_name()
                    .or_else(|_| monitor.name())
                    .unwrap_or_else(|_| "Monitor".into()),
                width: monitor.width().ok()?,
                height: monitor.height().ok()?,
                x: monitor.x().unwrap_or(0),
                y: monitor.y().unwrap_or(0),
                primary: monitor.is_primary().unwrap_or(false),
            })
        })
        .collect::<Vec<_>>();
    monitors.sort_by(|a, b| b.primary.cmp(&a.primary).then(a.id.cmp(&b.id)));
    Ok(monitors)
}

#[tauri::command]
pub fn list_screenshot_windows() -> AppResult<Vec<ScreenshotWindowInfo>> {
    Ok(collect_windows())
}

#[tauri::command]
pub async fn capture_monitor(app: AppHandle, monitor_id: u32) -> AppResult<ScreenshotCapture> {
    hide_main(&app)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(Duration::from_millis(40));
        let monitor = find_monitor(monitor_id)?;
        let image = monitor
            .capture_image()
            .map_err(|e| AppError::message(e.to_string()))?;
        save_webp(&image, &temp_png_path()?)
    })
    .await
    .map_err(|err| AppError::message(err.to_string()))?;
    show_main(&app);
    result
}

#[tauri::command]
pub async fn capture_window(window_id: u32) -> AppResult<ScreenshotCapture> {
    tauri::async_runtime::spawn_blocking(move || {
        let window = Window::all()
            .map_err(|e| AppError::message(e.to_string()))?
            .into_iter()
            .find(|window| window.id().ok() == Some(window_id))
            .ok_or(AppError::NotFound("Janela não encontrada"))?;
        if window.is_minimized().unwrap_or(false) {
            return Err(AppError::validation(
                "Essa janela está minimizada e não pode ser capturada",
            ));
        }
        let image = window
            .capture_image()
            .map_err(|e| AppError::message(e.to_string()))?;
        save_webp(&image, &temp_png_path()?)
    })
    .await
    .map_err(|err| AppError::message(err.to_string()))?
}

#[tauri::command]
pub async fn begin_region_capture(app: AppHandle) -> AppResult<RegionSessionDto> {
    start_snip_overlay(app).await
}

#[tauri::command]
pub fn get_region_session(window: WebviewWindow, app: AppHandle) -> AppResult<RegionSessionDto> {
    get_region_session_inner(&app, window.label())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn commit_snip_capture(
    window: WebviewWindow,
    app: AppHandle,
    action: String,
    x: Option<u32>,
    y: Option<u32>,
    width: Option<u32>,
    height: Option<u32>,
    dest_dir: Option<String>,
    file_name: Option<String>,
    png_base64: Option<String>,
) -> AppResult<()> {
    let annotated = png_base64.filter(|value| !value.trim().is_empty());
    let prepared = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock();
        let session = region
            .get(window.label())
            .ok_or(AppError::NotFound("Nenhuma seleção de área em andamento"))?;
        if annotated.is_some() {
            None
        } else if let (Some(x), Some(y), Some(width), Some(height)) = (x, y, width, height) {
            Some(crop_rgba(&session.image, x, y, width, height)?)
        } else {
            Some(session.image.clone())
        }
    };

    hide_overlays(&app);

    let app_archive = app.clone();
    let prepared = tauri::async_runtime::spawn_blocking(move || {
        if let Some(encoded) = annotated {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(encoded)
                .map_err(|e| AppError::message(e.to_string()))?;
            Ok(image::load_from_memory(&bytes)
                .map_err(|e| AppError::message(e.to_string()))?
                .to_rgba8())
        } else {
            prepared.ok_or(AppError::NotFound("Nenhuma seleção de área em andamento"))
        }
    })
    .await
    .map_err(|err| AppError::message(err.to_string()))??;

    let result = match action.as_str() {
        "copy" => copy_rgba_on_main(&app, &prepared)
            .and_then(|_| archive_screenshot(&app_archive, &prepared, &action)),
        "save" => tauri::async_runtime::spawn_blocking(move || {
            let dest_dir = dest_dir.unwrap_or_default();
            if dest_dir.trim().is_empty() {
                return Err(AppError::validation(
                    "Escolha uma pasta para salvar o print",
                ));
            }
            fs::create_dir_all(&dest_dir).map_err(|err| {
                AppError::message(format!("Não foi possível criar a pasta de destino: {err}"))
            })?;
            let name = file_name
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| format!("{}.png", Uuid::new_v4()));
            save_png(&prepared, &Path::new(&dest_dir).join(name))?;
            archive_screenshot(&app_archive, &prepared, &action)
        })
        .await
        .map_err(|err| AppError::message(err.to_string()))?,
        _ => Err(AppError::validation("Ação de print inválida")),
    };

    let item = match result {
        Ok(item) => item,
        Err(err) => {
            show_session_overlays(&app);
            return Err(err);
        }
    };
    app.state::<ScreenshotState>().region.lock().clear();
    if app
        .state::<ScreenshotState>()
        .restore_main
        .load(Ordering::SeqCst)
    {
        show_main(&app);
    }
    let _ = app.emit("screenshot-captured", &item);
    Ok(())
}

#[tauri::command]
pub async fn crop_screenshot(
    window: WebviewWindow,
    app: AppHandle,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> AppResult<ScreenshotCapture> {
    let source_path = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock();
        region
            .get(window.label())
            .ok_or(AppError::NotFound("Nenhuma seleção de área em andamento"))?
            .source_path
            .clone()
    };

    let capture = tauri::async_runtime::spawn_blocking(move || {
        let image = image::open(&source_path).map_err(|e| AppError::message(e.to_string()))?;
        let (img_w, img_h) = image.dimensions();
        if width == 0 || height == 0 {
            return Err(AppError::validation("Selecione uma área maior"));
        }
        let x = x.min(img_w.saturating_sub(1));
        let y = y.min(img_h.saturating_sub(1));
        let width = width.min(img_w.saturating_sub(x)).max(1);
        let height = height.min(img_h.saturating_sub(y)).max(1);
        let cropped = image.crop_imm(x, y, width, height);
        let out = temp_png_path()?;
        cropped
            .save(&out)
            .map_err(|e| AppError::message(e.to_string()))?;
        Ok(ScreenshotCapture {
            path: out.to_string_lossy().into_owned(),
            width: cropped.width(),
            height: cropped.height(),
        })
    })
    .await
    .map_err(|err| AppError::message(err.to_string()))??;

    complete_capture(&app, capture)
}

#[tauri::command]
pub fn finish_fullscreen_capture(
    window: WebviewWindow,
    app: AppHandle,
) -> AppResult<ScreenshotCapture> {
    let capture = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock();
        let session = region
            .get(window.label())
            .ok_or(AppError::NotFound("Nenhuma seleção de área em andamento"))?;
        ScreenshotCapture {
            path: session.source_path.clone(),
            width: session.width,
            height: session.height,
        }
    };
    complete_capture(&app, capture)
}

#[tauri::command]
pub fn cancel_region_capture(app: AppHandle, state: State<'_, ScreenshotState>) -> AppResult<()> {
    state.region.lock().clear();
    hide_overlays(&app);
    if state.restore_main.load(Ordering::SeqCst) {
        show_main(&app);
    }
    let _ = app.emit("screenshot-cancelled", ());
    Ok(())
}

#[tauri::command]
pub async fn copy_screenshot(app: AppHandle, path: String) -> AppResult<()> {
    let dib = tauri::async_runtime::spawn_blocking(move || {
        let image = image::open(&path)
            .map_err(|e| AppError::message(e.to_string()))?
            .to_rgba8();
        Ok::<_, AppError>(rgba_to_dib(&image))
    })
    .await
    .map_err(|err| AppError::message(err.to_string()))??;
    copy_dib_on_main(&app, dib)
}

#[tauri::command]
pub fn save_screenshot(
    source_path: String,
    dest_dir: String,
    file_name: String,
) -> AppResult<String> {
    if dest_dir.trim().is_empty() {
        return Err(AppError::validation(
            "Escolha uma pasta para salvar o print",
        ));
    }
    fs::create_dir_all(&dest_dir).map_err(|err| {
        AppError::message(format!("Não foi possível criar a pasta de destino: {err}"))
    })?;
    let dest = Path::new(&dest_dir).join(file_name);
    fs::copy(&source_path, &dest)?;
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn list_screenshot_history(app: AppHandle) -> AppResult<Vec<ScreenshotHistoryItem>> {
    let items = prune_history(read_history_index(&app));
    write_history_index(&app, &items)?;
    Ok(items)
}

#[tauri::command]
pub fn delete_screenshot_history(
    app: AppHandle,
    id: String,
) -> AppResult<Vec<ScreenshotHistoryItem>> {
    let mut items = read_history_index(&app);
    if let Some(index) = items.iter().position(|item| item.id == id) {
        let removed = items.remove(index);
        let _ = fs::remove_file(&removed.path);
    }
    let items = prune_history(items);
    write_history_index(&app, &items)?;
    Ok(items)
}

#[tauri::command]
pub fn default_picture_dir(app: AppHandle) -> AppResult<String> {
    app.path()
        .picture_dir()
        .or_else(|_| app.path().video_dir())
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|err| AppError::message(format!("Pasta de imagens não encontrada: {err}")))
}
