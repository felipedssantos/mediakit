use std::collections::HashMap;
use std::fs;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[cfg(not(windows))]
use arboard::{Clipboard, ImageData};
use base64::Engine;
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{ExtendedColorType, GenericImageView, ImageEncoder};
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, State,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use uuid::Uuid;
use xcap::{Monitor, Window};

const OVERLAY_LABEL: &str = "snip-overlay";
const HISTORY_LIMIT: usize = 100;

pub struct ScreenshotState {
    pub region: Mutex<HashMap<String, RegionSession>>,
    starting: AtomicBool,
    restore_main: AtomicBool,
}

impl ScreenshotState {
    pub fn new() -> Self {
        Self {
            region: Mutex::new(HashMap::new()),
            starting: AtomicBool::new(false),
            restore_main: AtomicBool::new(false),
        }
    }
}

struct MonitorShot {
    overlay_label: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    image: image::RgbaImage,
    capture: ScreenshotCapture,
}

pub struct RegionSession {
    pub overlay_label: String,
    pub source_path: String,
    pub image: image::RgbaImage,
    pub width: u32,
    pub height: u32,
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub windows: Vec<ScreenshotWindowInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotMonitorInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotWindowInfo {
    pub id: u32,
    pub title: String,
    pub app_name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotHistoryItem {
    pub id: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub created_at: i64,
    pub action: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotCapture {
    pub path: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct RegionSessionDto {
    pub overlay_label: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub windows: Vec<ScreenshotWindowInfo>,
}

fn map_err(err: impl ToString) -> String {
    err.to_string()
}

fn temp_png_path() -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("conversor-screenshots");
    fs::create_dir_all(&dir).map_err(map_err)?;
    Ok(dir.join(format!("{}.webp", Uuid::new_v4())))
}

fn save_webp(image: &image::RgbaImage, path: &Path) -> Result<ScreenshotCapture, String> {
    let width = image.width();
    let height = image.height();
    let encoder = webp::Encoder::from_rgba(image, width, height);
    let webp_data = encoder.encode(75.0);
    fs::write(path, &webp_data[..]).map_err(map_err)?;
    Ok(ScreenshotCapture {
        path: path.to_string_lossy().into_owned(),
        width,
        height,
    })
}

fn save_png(image: &image::RgbaImage, path: &Path) -> Result<(), String> {
    let file = fs::File::create(path).map_err(map_err)?;
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
        .map_err(map_err)
}

fn history_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(map_err)?
        .join("screenshots");
    fs::create_dir_all(&dir).map_err(map_err)?;
    Ok(dir)
}

fn history_index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(history_dir(app)?.join("index.json"))
}

fn read_history_index(app: &AppHandle) -> Vec<ScreenshotHistoryItem> {
    let Ok(path) = history_index_path(app) else {
        return Vec::new();
    };
    let Ok(bytes) = fs::read(&path) else {
        return Vec::new();
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn write_history_index(app: &AppHandle, items: &[ScreenshotHistoryItem]) -> Result<(), String> {
    let path = history_index_path(app)?;
    let bytes = serde_json::to_vec_pretty(items).map_err(map_err)?;
    fs::write(path, bytes).map_err(map_err)
}

fn prune_history(items: Vec<ScreenshotHistoryItem>) -> Vec<ScreenshotHistoryItem> {
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

fn archive_screenshot(
    app: &AppHandle,
    image: &image::RgbaImage,
    action: &str,
) -> Result<ScreenshotHistoryItem, String> {
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

fn rgba_to_dib(image: &image::RgbaImage) -> Vec<u8> {
    let width = image.width();
    let height = image.height();
    let pixel_bytes = (width as usize).saturating_mul(height as usize).saturating_mul(4);
    let mut dib = vec![0u8; 40 + pixel_bytes];
    dib[0..4].copy_from_slice(&40u32.to_le_bytes());
    dib[4..8].copy_from_slice(&(width as i32).to_le_bytes());
    dib[8..12].copy_from_slice(&(-(height as i32)).to_le_bytes());
    dib[12..14].copy_from_slice(&1u16.to_le_bytes());
    dib[14..16].copy_from_slice(&32u16.to_le_bytes());
    dib[20..24].copy_from_slice(&(pixel_bytes as u32).to_le_bytes());
    let src = image.as_raw();
    let dst = &mut dib[40..];
    for (index, pixel) in src.chunks_exact(4).enumerate() {
        let offset = index * 4;
        dst[offset] = pixel[2];
        dst[offset + 1] = pixel[1];
        dst[offset + 2] = pixel[0];
        dst[offset + 3] = pixel[3];
    }
    dib
}

#[cfg(windows)]
fn set_clipboard_image_bytes(dib: &[u8]) -> Result<(), String> {
    let _clip = clipboard_win::Clipboard::new_attempts(10).map_err(map_err)?;
    clipboard_win::raw::set(clipboard_win::formats::CF_DIB, dib).map_err(map_err)
}

#[cfg(not(windows))]
fn set_clipboard_image_bytes(dib: &[u8]) -> Result<(), String> {
    let _ = dib;
    Err("Cópia de print não suportada nesta plataforma".into())
}

#[cfg(not(windows))]
fn copy_rgba(image: &image::RgbaImage) -> Result<(), String> {
    let (width, height) = image.dimensions();
    let mut clipboard = Clipboard::new().map_err(map_err)?;
    clipboard
        .set_image(ImageData {
            width: width as usize,
            height: height as usize,
            bytes: image.as_raw().clone().into(),
        })
        .map_err(map_err)
}

fn copy_dib_on_main(app: &AppHandle, dib: Vec<u8>) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(set_clipboard_image_bytes(&dib));
    })
    .map_err(map_err)?;
    rx.recv()
        .map_err(|_| "Não foi possível copiar para a área de transferência".to_string())?
}

fn copy_rgba_on_main(app: &AppHandle, image: &image::RgbaImage) -> Result<(), String> {
    #[cfg(windows)]
    {
        let dib = rgba_to_dib(image);
        return copy_dib_on_main(app, dib);
    }
    #[cfg(not(windows))]
    {
        let image = image.clone();
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(copy_rgba(&image));
        })
        .map_err(map_err)?;
        rx.recv()
            .map_err(|_| "Não foi possível copiar para a área de transferência".to_string())?
    }
}

fn crop_rgba(
    image: &image::RgbaImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<image::RgbaImage, String> {
    if width == 0 || height == 0 {
        return Err("Selecione uma área maior".to_string());
    }
    let img_w = image.width();
    let img_h = image.height();
    let x = x.min(img_w.saturating_sub(1));
    let y = y.min(img_h.saturating_sub(1));
    let width = width.min(img_w.saturating_sub(x)).max(1);
    let height = height.min(img_h.saturating_sub(y)).max(1);
    Ok(image::imageops::crop_imm(image, x, y, width, height).to_image())
}

fn find_monitor(id: u32) -> Result<Monitor, String> {
    Monitor::all()
        .map_err(map_err)?
        .into_iter()
        .find(|monitor| monitor.id().ok() == Some(id))
        .ok_or_else(|| "Monitor não encontrado".into())
}

fn cursor_pos() -> (i32, i32) {
    #[cfg(windows)]
    {
        #[repr(C)]
        struct Point {
            x: i32,
            y: i32,
        }
        unsafe extern "system" {
            fn GetCursorPos(lp_point: *mut Point) -> i32;
        }
        let mut point = Point { x: 0, y: 0 };
        if unsafe { GetCursorPos(&mut point) } != 0 {
            return (point.x, point.y);
        }
    }
    (0, 0)
}

fn collect_windows() -> Vec<ScreenshotWindowInfo> {
    let mut windows = Window::all()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|window| {
            if window.is_minimized().unwrap_or(true) {
                return None;
            }
            let width = window.width().unwrap_or(0);
            let height = window.height().unwrap_or(0);
            if width < 32 || height < 32 {
                return None;
            }
            let title = window.title().unwrap_or_default();
            let app_name = window.app_name().unwrap_or_default();
            if title.trim().is_empty() && app_name.trim().is_empty() {
                return None;
            }
            if title == "Conversor" || title == "Selecionar área" {
                return None;
            }
            Some((
                window.z().unwrap_or(0),
                ScreenshotWindowInfo {
                    id: window.id().ok()?,
                    title: if title.trim().is_empty() {
                        app_name.clone()
                    } else {
                        title
                    },
                    app_name,
                    width,
                    height,
                    x: window.x().unwrap_or(0),
                    y: window.y().unwrap_or(0),
                },
            ))
        })
        .collect::<Vec<_>>();
    windows.sort_by(|a, b| b.0.cmp(&a.0));
    windows.into_iter().map(|(_, info)| info).collect()
}

fn hide_main(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(map_err)?;
    }
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn is_snip_overlay_label(label: &str) -> bool {
    label == OVERLAY_LABEL || label.starts_with(&format!("{OVERLAY_LABEL}-"))
}

fn overlay_label_for(index: usize, monitor_id: u32) -> String {
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

fn hide_overlays(app: &AppHandle) {
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

fn create_overlay_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::App("index.html?snip=1".into()),
    )
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
    .map_err(|err| format!("Não foi possível preparar o overlay de print: {err}"))
}

fn ensure_overlay_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
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

fn capture_all_monitors() -> Result<Vec<MonitorShot>, String> {
    let mut monitors = Monitor::all().map_err(map_err)?;
    monitors.sort_by(|a, b| {
        b.is_primary()
            .unwrap_or(false)
            .cmp(&a.is_primary().unwrap_or(false))
            .then(a.id().unwrap_or(0).cmp(&b.id().unwrap_or(0)))
    });
    if monitors.is_empty() {
        return Err("Nenhum monitor encontrado".to_string());
    }
    let mut shots = Vec::new();
    for (index, monitor) in monitors.into_iter().enumerate() {
        let monitor_id = monitor.id().unwrap_or(index as u32);
        let x = monitor.x().unwrap_or(0);
        let y = monitor.y().unwrap_or(0);
        let width = monitor.width().map_err(map_err)?;
        let height = monitor.height().map_err(map_err)?;
        let image = monitor.capture_image().map_err(map_err)?;
        let capture = save_webp(&image, &temp_png_path()?)?;
        shots.push(MonitorShot {
            overlay_label: overlay_label_for(index, monitor_id),
            x,
            y,
            width,
            height,
            image,
            capture,
        });
    }
    Ok(shots)
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

fn show_session_overlays(app: &AppHandle) -> Result<(), String> {
    let labels: Vec<String> = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock().map_err(map_err)?;
        region.keys().cloned().collect()
    };
    for label in labels {
        if let Some(overlay) = app.get_webview_window(&label) {
            let _ = overlay.set_always_on_top(true);
            let _ = overlay.show();
        }
    }
    Ok(())
}

fn restore_after_overlay(app: &AppHandle) {
    hide_overlays(app);
    let restore = app
        .state::<ScreenshotState>()
        .restore_main
        .load(Ordering::SeqCst);
    if restore {
        show_main(app);
    }
}

fn complete_capture(app: &AppHandle, capture: ScreenshotCapture) -> Result<ScreenshotCapture, String> {
    {
        let state = app.state::<ScreenshotState>();
        let mut region = state.region.lock().map_err(map_err)?;
        region.clear();
    }
    restore_after_overlay(app);
    let _ = app.emit("screenshot-captured", &capture);
    Ok(capture)
}

fn session_dto_for(
    region: &HashMap<String, RegionSession>,
    label: &str,
) -> Result<RegionSessionDto, String> {
    region
        .get(label)
        .map(session_to_dto)
        .ok_or_else(|| "Nenhuma seleção de área em andamento".to_string())
}

#[tauri::command]
pub fn list_screenshot_monitors() -> Result<Vec<ScreenshotMonitorInfo>, String> {
    let mut monitors = Monitor::all()
        .map_err(map_err)?
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
pub fn list_screenshot_windows() -> Result<Vec<ScreenshotWindowInfo>, String> {
    Ok(collect_windows())
}

#[tauri::command]
pub async fn capture_monitor(app: AppHandle, monitor_id: u32) -> Result<ScreenshotCapture, String> {
    hide_main(&app)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(Duration::from_millis(40));
        let monitor = find_monitor(monitor_id)?;
        let image = monitor.capture_image().map_err(map_err)?;
        save_webp(&image, &temp_png_path()?)
    })
    .await
    .map_err(|err| err.to_string())?;
    show_main(&app);
    result
}

#[tauri::command]
pub async fn capture_window(window_id: u32) -> Result<ScreenshotCapture, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let window = Window::all()
            .map_err(map_err)?
            .into_iter()
            .find(|window| window.id().ok() == Some(window_id))
            .ok_or_else(|| "Janela não encontrada".to_string())?;
        if window.is_minimized().unwrap_or(false) {
            return Err("Essa janela está minimizada e não pode ser capturada".into());
        }
        let image = window.capture_image().map_err(map_err)?;
        save_webp(&image, &temp_png_path()?)
    })
    .await
    .map_err(|err| err.to_string())?
}

pub fn ensure_overlay(app: &AppHandle) -> Result<(), String> {
    ensure_overlay_window(app, OVERLAY_LABEL).map(|_| ())
}

fn show_monitor_overlays(app: &AppHandle, shots: &[MonitorShot], dtos: &HashMap<String, RegionSessionDto>, windows: &[ScreenshotWindowInfo]) -> Result<(), String> {
    let used: Vec<String> = shots.iter().map(|shot| shot.overlay_label.clone()).collect();
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

pub async fn start_snip_overlay(app: AppHandle) -> Result<RegionSessionDto, String> {
    if overlay_is_visible(&app) {
        return get_region_session_inner(&app, OVERLAY_LABEL);
    }
    {
        let state = app.state::<ScreenshotState>();
        if state.starting.swap(true, Ordering::SeqCst) {
            return Err("O overlay de print já está abrindo".into());
        }
    }

    let result = open_snip_overlay(app.clone()).await;
    app.state::<ScreenshotState>()
        .starting
        .store(false, Ordering::SeqCst);
    result
}

async fn open_snip_overlay(app: AppHandle) -> Result<RegionSessionDto, String> {
    app.state::<ScreenshotState>()
        .restore_main
        .store(main_is_visible(&app), Ordering::SeqCst);

    let windows_task = tauri::async_runtime::spawn_blocking(collect_windows);

    let shots = tauri::async_runtime::spawn_blocking(capture_all_monitors)
        .await
        .map_err(|err| err.to_string())??;

    let windows = windows_task
        .await
        .map_err(|err| err.to_string())
        .unwrap_or_default();

    let (first_dto, dtos) = {
        let state = app.state::<ScreenshotState>();
        let mut region = state.region.lock().map_err(map_err)?;
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
            .ok_or_else(|| "Nenhum monitor encontrado".to_string())?;
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
    .map_err(map_err)?;
    rx.recv()
        .map_err(|_| "Não foi possível abrir o overlay de print".to_string())??;

    if main_is_visible(&app) {
        hide_main(&app)?;
    }

    Ok(first_dto)
}

fn get_region_session_inner(app: &AppHandle, label: &str) -> Result<RegionSessionDto, String> {
    let state = app.state::<ScreenshotState>();
    let region = state.region.lock().map_err(map_err)?;
    session_dto_for(&region, label)
}

#[tauri::command]
pub async fn begin_region_capture(app: AppHandle) -> Result<RegionSessionDto, String> {
    start_snip_overlay(app).await
}

#[tauri::command]
pub fn get_region_session(window: WebviewWindow, app: AppHandle) -> Result<RegionSessionDto, String> {
    get_region_session_inner(&app, window.label())
}

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
) -> Result<(), String> {
    let annotated = png_base64.filter(|value| !value.trim().is_empty());
    let prepared = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock().map_err(map_err)?;
        let session = region
            .get(window.label())
            .ok_or_else(|| "Nenhuma seleção de área em andamento".to_string())?;
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
                .map_err(map_err)?;
            Ok(image::load_from_memory(&bytes)
                .map_err(map_err)?
                .to_rgba8())
        } else {
            prepared.ok_or_else(|| "Nenhuma seleção de área em andamento".to_string())
        }
    })
    .await
    .map_err(|err| err.to_string())??;

    let result = match action.as_str() {
        "copy" => copy_rgba_on_main(&app, &prepared).and_then(|_| {
            archive_screenshot(&app_archive, &prepared, &action)
        }),
        "save" => tauri::async_runtime::spawn_blocking(move || {
            let dest_dir = dest_dir.unwrap_or_default();
            if dest_dir.trim().is_empty() {
                return Err("Escolha uma pasta para salvar o print".to_string());
            }
            fs::create_dir_all(&dest_dir).map_err(|err| {
                format!("Não foi possível criar a pasta de destino: {err}")
            })?;
            let name = file_name
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| format!("{}.png", Uuid::new_v4()));
            save_png(&prepared, &Path::new(&dest_dir).join(name))?;
            archive_screenshot(&app_archive, &prepared, &action)
        })
        .await
        .map_err(|err| err.to_string())?,
        _ => Err("Ação de print inválida".to_string()),
    };

    let item = match result {
        Ok(item) => item,
        Err(err) => {
            if let Err(err) = show_session_overlays(&app) {
                return Err(err);
            }
            return Err(err);
        }
    };
    {
        let state = app.state::<ScreenshotState>();
        let mut region = state.region.lock().map_err(map_err)?;
        region.clear();
    }
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
) -> Result<ScreenshotCapture, String> {
    let source_path = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock().map_err(map_err)?;
        region
            .get(window.label())
            .ok_or_else(|| "Nenhuma seleção de área em andamento".to_string())?
            .source_path
            .clone()
    };

    let capture = tauri::async_runtime::spawn_blocking(move || {
        let image = image::open(&source_path).map_err(map_err)?;
        let (img_w, img_h) = image.dimensions();
        if width == 0 || height == 0 {
            return Err("Selecione uma área maior".to_string());
        }
        let x = x.min(img_w.saturating_sub(1));
        let y = y.min(img_h.saturating_sub(1));
        let width = width.min(img_w.saturating_sub(x)).max(1);
        let height = height.min(img_h.saturating_sub(y)).max(1);
        let cropped = image.crop_imm(x, y, width, height);
        let out = temp_png_path()?;
        cropped.save(&out).map_err(map_err)?;
        Ok(ScreenshotCapture {
            path: out.to_string_lossy().into_owned(),
            width: cropped.width(),
            height: cropped.height(),
        })
    })
    .await
    .map_err(|err| err.to_string())??;

    complete_capture(&app, capture)
}

#[tauri::command]
pub fn finish_fullscreen_capture(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<ScreenshotCapture, String> {
    let capture = {
        let state = app.state::<ScreenshotState>();
        let region = state.region.lock().map_err(map_err)?;
        let session = region
            .get(window.label())
            .ok_or_else(|| "Nenhuma seleção de área em andamento".to_string())?;
        ScreenshotCapture {
            path: session.source_path.clone(),
            width: session.width,
            height: session.height,
        }
    };
    complete_capture(&app, capture)
}

#[tauri::command]
pub fn cancel_region_capture(
    app: AppHandle,
    state: State<'_, ScreenshotState>,
) -> Result<(), String> {
    {
        let mut region = state.region.lock().map_err(map_err)?;
        region.clear();
    }
    hide_overlays(&app);
    if state.restore_main.load(Ordering::SeqCst) {
        show_main(&app);
    }
    let _ = app.emit("screenshot-cancelled", ());
    Ok(())
}

#[tauri::command]
pub async fn copy_screenshot(app: AppHandle, path: String) -> Result<(), String> {
    let dib = tauri::async_runtime::spawn_blocking(move || {
        let image = image::open(&path).map_err(map_err)?.to_rgba8();
        Ok::<_, String>(rgba_to_dib(&image))
    })
    .await
    .map_err(|err| err.to_string())??;
    copy_dib_on_main(&app, dib)
}

#[tauri::command]
pub fn save_screenshot(
    source_path: String,
    dest_dir: String,
    file_name: String,
) -> Result<String, String> {
    if dest_dir.trim().is_empty() {
        return Err("Escolha uma pasta para salvar o print".into());
    }
    fs::create_dir_all(&dest_dir).map_err(|err| {
        format!("Não foi possível criar a pasta de destino: {err}")
    })?;
    let dest = Path::new(&dest_dir).join(file_name);
    fs::copy(&source_path, &dest).map_err(map_err)?;
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn list_screenshot_history(app: AppHandle) -> Result<Vec<ScreenshotHistoryItem>, String> {
    let items = prune_history(read_history_index(&app));
    write_history_index(&app, &items)?;
    Ok(items)
}

#[tauri::command]
pub fn delete_screenshot_history(app: AppHandle, id: String) -> Result<Vec<ScreenshotHistoryItem>, String> {
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
pub fn default_picture_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .picture_dir()
        .or_else(|_| app.path().video_dir())
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|err| format!("Pasta de imagens não encontrada: {err}"))
}
