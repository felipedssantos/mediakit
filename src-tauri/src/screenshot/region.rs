use std::collections::HashMap;
use std::sync::atomic::Ordering;

use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

use crate::error::{AppError, AppResult};
use crate::screenshot::capture::{capture_all_monitors, MonitorShot};
use crate::screenshot::windows::{collect_windows, cursor_pos};
use crate::screenshot::{
    RegionSession, RegionSessionDto, ScreenshotCapture, ScreenshotState, ScreenshotWindowInfo,
};

pub const OVERLAY_LABEL: &str = "snip-overlay";

pub fn hide_main(app: &AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .hide()
            .map_err(|e| AppError::message(e.to_string()))?;
    }
    Ok(())
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn is_snip_overlay_label(label: &str) -> bool {
    label == OVERLAY_LABEL || label.starts_with(&format!("{OVERLAY_LABEL}-"))
}

pub fn overlay_label_for(index: usize, monitor_id: u32) -> String {
    if index == 0 {
        OVERLAY_LABEL.to_string()
    } else {
        format!("{OVERLAY_LABEL}-{monitor_id}")
    }
}

fn overlay_windows(app: &AppHandle) -> Vec<WebviewWindow> {
    app.webview_windows()
        .into_values()
        .filter(|window| is_snip_overlay_label(window.label()))
        .collect()
}

pub fn hide_overlays(app: &AppHandle) {
    for window in overlay_windows(app) {
        let _ = window.hide();
    }
}

fn overlay_is_visible(app: &AppHandle) -> bool {
    overlay_windows(app)
        .iter()
        .any(|window| window.is_visible().unwrap_or(false))
}

fn point_in_monitor(px: i32, py: i32, x: i32, y: i32, width: u32, height: u32) -> bool {
    px >= x && py >= y && px < x + width as i32 && py < y + height as i32
}

fn create_overlay_window(app: &AppHandle, label: &str) -> AppResult<WebviewWindow> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html?snip=1".into()))
        .initialization_script("window.__CONVERSOR_SNIP__ = true;")
        .title("Selecionar área")
        .decorations(false)
        .transparent(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .visible(false)
        .focused(false)
        .build()
        .map_err(|err| {
            AppError::message(format!(
                "Não foi possível preparar o overlay de print: {err}"
            ))
        })
}

fn ensure_overlay_window(app: &AppHandle, label: &str) -> AppResult<WebviewWindow> {
    if let Some(existing) = app.get_webview_window(label) {
        return Ok(existing);
    }
    create_overlay_window(app, label)
}

fn main_is_visible(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

fn session_to_dto(session: &RegionSession) -> RegionSessionDto {
    RegionSessionDto {
        overlay_label: session.overlay_label.clone(),
        path: session.source_path.clone(),
        width: session.width,
        height: session.height,
        monitor_x: session.monitor_x,
        monitor_y: session.monitor_y,
        windows: session.windows.clone(),
    }
}

pub fn show_session_overlays(app: &AppHandle) {
    let labels: Vec<String> = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock();
        region.keys().cloned().collect()
    };
    for label in labels {
        if let Some(overlay) = app.get_webview_window(&label) {
            let _ = overlay.set_always_on_top(true);
            let _ = overlay.show();
        }
    }
}

pub fn restore_after_overlay(app: &AppHandle) {
    hide_overlays(app);
    let restore = app
        .state::<ScreenshotState>()
        .restore_main
        .load(Ordering::SeqCst);
    if restore {
        show_main(app);
    }
}

pub fn complete_capture(
    app: &AppHandle,
    capture: ScreenshotCapture,
) -> AppResult<ScreenshotCapture> {
    app.state::<ScreenshotState>().region.lock().clear();
    restore_after_overlay(app);
    let _ = app.emit("screenshot-captured", &capture);
    Ok(capture)
}

fn session_dto_for(
    region: &HashMap<String, RegionSession>,
    label: &str,
) -> AppResult<RegionSessionDto> {
    region
        .get(label)
        .map(session_to_dto)
        .ok_or(AppError::NotFound("Nenhuma seleção de área em andamento"))
}

pub fn ensure_overlay(app: &AppHandle) -> AppResult<()> {
    ensure_overlay_window(app, OVERLAY_LABEL).map(|_| ())
}

fn show_monitor_overlays(
    app: &AppHandle,
    shots: &[MonitorShot],
    dtos: &HashMap<String, RegionSessionDto>,
    windows: &[ScreenshotWindowInfo],
) -> AppResult<()> {
    let used: Vec<String> = shots
        .iter()
        .map(|shot| shot.overlay_label.clone())
        .collect();
    let (cx, cy) = cursor_pos();
    let focus_label = shots
        .iter()
        .find(|shot| point_in_monitor(cx, cy, shot.x, shot.y, shot.width, shot.height))
        .map(|shot| shot.overlay_label.clone())
        .or_else(|| used.first().cloned());

    for shot in shots {
        let overlay = ensure_overlay_window(app, &shot.overlay_label)?;
        let _ = overlay.set_position(Position::Physical(PhysicalPosition::new(shot.x, shot.y)));
        let _ = overlay.set_size(Size::Physical(PhysicalSize::new(shot.width, shot.height)));
        let _ = overlay.set_always_on_top(true);
        let _ = overlay.show();
        if let Some(dto) = dtos.get(&shot.overlay_label) {
            let _ = overlay.emit("snip-session-ready", dto);
            let _ = overlay.emit("snip-windows-ready", windows);
        }
    }

    for window in overlay_windows(app) {
        if !used.iter().any(|label| label == window.label()) {
            let _ = window.hide();
        }
    }

    if let Some(label) = focus_label {
        if let Some(overlay) = app.get_webview_window(&label) {
            let _ = overlay.set_focus();
        }
    }
    Ok(())
}

pub async fn start_snip_overlay(app: AppHandle) -> AppResult<RegionSessionDto> {
    if overlay_is_visible(&app) {
        return get_region_session_inner(&app, OVERLAY_LABEL);
    }
    {
        let state = app.state::<ScreenshotState>();
        if state.starting.swap(true, Ordering::SeqCst) {
            return Err(AppError::validation("O overlay de print já está abrindo"));
        }
    }

    let result = open_snip_overlay(app.clone()).await;
    app.state::<ScreenshotState>()
        .starting
        .store(false, Ordering::SeqCst);
    result
}

async fn open_snip_overlay(app: AppHandle) -> AppResult<RegionSessionDto> {
    app.state::<ScreenshotState>()
        .restore_main
        .store(main_is_visible(&app), Ordering::SeqCst);

    let windows_task = tauri::async_runtime::spawn_blocking(collect_windows);

    let shots = tauri::async_runtime::spawn_blocking(capture_all_monitors)
        .await
        .map_err(|err| AppError::message(err.to_string()))??;

    let windows = windows_task
        .await
        .map_err(|err| AppError::message(err.to_string()))
        .unwrap_or_default();

    let (first_dto, dtos) = {
        let state = app.state::<ScreenshotState>();
        let mut region = state.region.lock();
        region.clear();
        let mut dtos = HashMap::new();
        for shot in &shots {
            let session = RegionSession {
                overlay_label: shot.overlay_label.clone(),
                source_path: shot.capture.path.clone(),
                image: shot.image.clone(),
                width: shot.capture.width,
                height: shot.capture.height,
                monitor_x: shot.x,
                monitor_y: shot.y,
                windows: windows.clone(),
            };
            let dto = session_to_dto(&session);
            dtos.insert(shot.overlay_label.clone(), dto);
            region.insert(shot.overlay_label.clone(), session);
        }
        let first = shots
            .first()
            .and_then(|shot| dtos.get(&shot.overlay_label).cloned())
            .ok_or(AppError::NotFound("Nenhum monitor encontrado"))?;
        (first, dtos)
    };

    let app_ui = app.clone();
    let shots_ui = shots;
    let dtos_ui = dtos;
    let windows_ui = windows;
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let result = show_monitor_overlays(&app_ui, &shots_ui, &dtos_ui, &windows_ui);
        let _ = tx.send(result);
    })
    .map_err(|e| AppError::message(e.to_string()))?;
    rx.recv()
        .map_err(|_| AppError::message("Não foi possível abrir o overlay de print"))??;

    if main_is_visible(&app) {
        hide_main(&app)?;
    }

    Ok(first_dto)
}

pub fn get_region_session_inner(app: &AppHandle, label: &str) -> AppResult<RegionSessionDto> {
    let state = app.state::<ScreenshotState>();
    let region = state.region.lock();
    session_dto_for(&region, label)
}
