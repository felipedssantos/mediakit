use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;

use base64::Engine;
use serde::Deserialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::screenshot::capture::{
    archive_screenshot, crop_rgba, prune_history, read_history_index, save_png, write_history_index,
};
use crate::screenshot::clipboard::copy_rgba_on_main;
use crate::screenshot::region::{
    get_region_session_inner, hide_overlays, show_main, show_session_overlays, start_snip_overlay,
};
use crate::screenshot::{RegionSessionDto, ScreenshotHistoryItem, ScreenshotState};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnnotatedMeta {
    action: String,
    dest_dir: Option<String>,
    file_name: Option<String>,
}

async fn finalize_snip_image(
    app: &AppHandle,
    action: String,
    prepared: image::RgbaImage,
    dest_dir: Option<String>,
    file_name: Option<String>,
) -> AppResult<()> {
    let app_archive = app.clone();
    let result = match action.as_str() {
        "copy" => copy_rgba_on_main(app, &prepared)
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
            show_session_overlays(app);
            return Err(err);
        }
    };
    app.state::<ScreenshotState>().region.lock().clear();
    if app
        .state::<ScreenshotState>()
        .restore_main
        .load(Ordering::SeqCst)
    {
        show_main(app);
    }
    let _ = app.emit("screenshot-captured", &item);
    Ok(())
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
) -> AppResult<()> {
    let prepared = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock();
        let session = region
            .get(window.label())
            .ok_or(AppError::NotFound("Nenhuma seleção de área em andamento"))?;
        if let (Some(x), Some(y), Some(width), Some(height)) = (x, y, width, height) {
            crop_rgba(&session.image, x, y, width, height)?
        } else {
            session.image.clone()
        }
    };

    hide_overlays(&app);
    finalize_snip_image(&app, action, prepared, dest_dir, file_name).await
}

#[tauri::command]
pub async fn commit_snip_annotated(
    window: WebviewWindow,
    app: AppHandle,
    request: Request<'_>,
) -> AppResult<()> {
    {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock();
        if !region.contains_key(window.label()) {
            return Err(AppError::NotFound("Nenhuma seleção de área em andamento"));
        }
    }

    let meta_header = request
        .headers()
        .get("x-snip-meta")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::validation("Metadados do print ausentes"))?;
    let meta_bytes = base64::engine::general_purpose::STANDARD
        .decode(meta_header)
        .map_err(|e| AppError::message(e.to_string()))?;
    let meta: AnnotatedMeta =
        serde_json::from_slice(&meta_bytes).map_err(|e| AppError::message(e.to_string()))?;

    let png_bytes = match request.body() {
        InvokeBody::Raw(bytes) if !bytes.is_empty() => bytes.clone(),
        _ => return Err(AppError::validation("Imagem anotada ausente")),
    };

    hide_overlays(&app);

    let prepared = tauri::async_runtime::spawn_blocking(move || {
        Ok::<_, AppError>(
            image::load_from_memory(&png_bytes)
                .map_err(|e| AppError::message(e.to_string()))?
                .to_rgba8(),
        )
    })
    .await
    .map_err(|err| AppError::message(err.to_string()))??;

    finalize_snip_image(&app, meta.action, prepared, meta.dest_dir, meta.file_name).await
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
    let image = tauri::async_runtime::spawn_blocking(move || {
        Ok::<_, AppError>(
            image::open(&path)
                .map_err(|e| AppError::message(e.to_string()))?
                .to_rgba8(),
        )
    })
    .await
    .map_err(|err| AppError::message(err.to_string()))??;
    copy_rgba_on_main(&app, &image)
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
