mod capture;
mod clipboard;
pub mod commands;
mod region;
mod windows;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

pub use clipboard::rgba_to_bmp;
pub use region::{ensure_overlay, start_snip_overlay};

pub struct ScreenshotState {
    pub region: Mutex<HashMap<String, RegionSession>>,
    pub starting: AtomicBool,
    pub restore_main: AtomicBool,
    pub next_session_id: AtomicU64,
}

impl ScreenshotState {
    pub fn new() -> Self {
        Self {
            region: Mutex::new(HashMap::new()),
            starting: AtomicBool::new(false),
            restore_main: AtomicBool::new(false),
            next_session_id: AtomicU64::new(1),
        }
    }
}

pub struct RegionSession {
    pub session_id: u64,
    pub overlay_label: String,
    pub image: image::RgbaImage,
    pub width: u32,
    pub height: u32,
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub windows: Vec<ScreenshotWindowInfo>,
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
pub struct RegionSessionDto {
    pub session_id: u64,
    pub overlay_label: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub windows: Vec<ScreenshotWindowInfo>,
}
