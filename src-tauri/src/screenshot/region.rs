use std::collections::HashMap;
use std::sync::atomic::Ordering;

use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

use crate::error::{AppError, AppResult};
use crate::screenshot::capture::{capture_all_monitors, sorted_monitors, MonitorShot};
use crate::screenshot::windows::{collect_windows, cursor_pos};
use crate::screenshot::{RegionSession, RegionSessionDto, ScreenshotState};

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
        .initialization_script("window.__MEDIAKIT_SNIP__ = true;")
        .title("Selecionar área")
        .decorations(false)
        .transparent(true)
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

fn main_needs_hide(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .map(|window| {
            window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false)
        })
        .unwrap_or(false)
}

#[cfg(windows)]
fn wait_compositor_frame() {
    #[link(name = "dwmapi")]
    unsafe extern "system" {
        fn DwmFlush() -> i32;
    }
    unsafe {
        let _ = DwmFlush();
    }
}

#[cfg(not(windows))]
fn wait_compositor_frame() {
    std::thread::sleep(std::time::Duration::from_millis(30));
}

fn session_to_dto(session: &RegionSession) -> RegionSessionDto {
    RegionSessionDto {
        session_id: session.session_id,
        overlay_label: session.overlay_label.clone(),
        path: format!("{}_{}", session.session_id, session.overlay_label),
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

fn session_dto_for(
    region: &HashMap<String, RegionSession>,
    label: &str,
) -> AppResult<RegionSessionDto> {
    region
        .get(label)
        .map(session_to_dto)
        .ok_or(AppError::NotFound("Nenhuma seleção de área em andamento"))
}

/// Pre-warms one hidden overlay WebView per connected monitor so Print Screen opens instantly.
pub fn ensure_overlay(app: &AppHandle) -> AppResult<()> {
    let Ok(monitors) = sorted_monitors() else {
        return ensure_overlay_window(app, OVERLAY_LABEL).map(|_| ());
    };
    for (index, monitor) in monitors.into_iter().enumerate() {
        let id = monitor.id().unwrap_or(index as u32);
        let label = overlay_label_for(index, id);
        let overlay = ensure_overlay_window(app, &label)?;
        if let (Ok(x), Ok(y), Ok(w), Ok(h)) =
            (monitor.x(), monitor.y(), monitor.width(), monitor.height())
        {
            let _ = overlay.set_position(Position::Physical(PhysicalPosition::new(x, y)));
            let _ = overlay.set_size(Size::Physical(PhysicalSize::new(w, h)));
        }
    }
    Ok(())
}

fn show_monitor_overlays(
    app: &AppHandle,
    shots: &[MonitorShot],
    dtos: &HashMap<String, RegionSessionDto>,
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
        let pos = Position::Physical(PhysicalPosition::new(shot.x, shot.y));
        let size = Size::Physical(PhysicalSize::new(shot.width, shot.height));
        let _ = overlay.set_position(pos);
        let _ = overlay.set_size(size);
        if let Some(dto) = dtos.get(&shot.overlay_label) {
            let _ = overlay.emit("snip-session-ready", dto);
        }
        let _ = overlay.set_always_on_top(true);
        let _ = overlay.show();
        // Re-apply physical size after show so cross-monitor DPI changes do not clamp bounds.
        let _ = overlay.set_size(size);
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
    let should_hide = main_needs_hide(&app);
    app.state::<ScreenshotState>()
        .restore_main
        .store(should_hide, Ordering::SeqCst);

    if should_hide {
        let app_hide = app.clone();
        let _ = app.run_on_main_thread(move || {
            let _ = hide_main(&app_hide);
        });
        let _ = tauri::async_runtime::spawn_blocking(wait_compositor_frame).await;
    }

    let windows_task = tauri::async_runtime::spawn_blocking(collect_windows);
    let shots = tauri::async_runtime::spawn_blocking(capture_all_monitors)
        .await
        .map_err(|err| AppError::message(err.to_string()))??;

    let session_id = app
        .state::<ScreenshotState>()
        .next_session_id
        .fetch_add(1, Ordering::SeqCst);

    let (first_dto, dtos, labels) = {
        let state = app.state::<ScreenshotState>();
        let mut region = state.region.lock();
        region.clear();
        let mut dtos = HashMap::new();
        let mut labels = Vec::with_capacity(shots.len());
        for shot in &shots {
            let session = RegionSession {
                session_id,
                overlay_label: shot.overlay_label.clone(),
                image: shot.image.clone(),
                width: shot.image.width(),
                height: shot.image.height(),
                monitor_x: shot.x,
                monitor_y: shot.y,
                windows: Vec::new(),
            };
            let dto = session_to_dto(&session);
            dtos.insert(shot.overlay_label.clone(), dto);
            labels.push(shot.overlay_label.clone());
            region.insert(shot.overlay_label.clone(), session);
        }
        let first = shots
            .first()
            .and_then(|shot| dtos.get(&shot.overlay_label).cloned())
            .ok_or(AppError::NotFound("Nenhum monitor encontrado"))?;
        (first, dtos, labels)
    };

    let app_ui = app.clone();
    let shots_ui = shots;
    let dtos_ui = dtos;
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let result = show_monitor_overlays(&app_ui, &shots_ui, &dtos_ui);
        let _ = tx.send(result);
    })
    .map_err(|e| AppError::message(e.to_string()))?;
    rx.recv()
        .map_err(|_| AppError::message("Não foi possível abrir o overlay de print"))??;

    // Deliver window bounds asynchronously so slow/hung processes never delay overlay opening.
    let app_windows = app.clone();
    tauri::async_runtime::spawn(async move {
        let windows = windows_task.await.unwrap_or_default();
        {
            let state = app_windows.state::<ScreenshotState>();
            let mut region = state.region.lock();
            for session in region.values_mut() {
                if session.session_id == session_id {
                    session.windows = windows.clone();
                }
            }
        }
        for label in labels {
            if let Some(overlay) = app_windows.get_webview_window(&label) {
                let _ = overlay.emit("snip-windows-ready", &windows);
            }
        }
    });

    Ok(first_dto)
}

pub fn get_region_session_inner(app: &AppHandle, label: &str) -> AppResult<RegionSessionDto> {
    let state = app.state::<ScreenshotState>();
    let region = state.region.lock();
    session_dto_for(&region, label)
}
