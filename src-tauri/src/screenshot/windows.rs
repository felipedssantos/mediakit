use xcap::{Monitor, Window};

use crate::error::{AppError, AppResult};
use crate::screenshot::ScreenshotWindowInfo;

pub fn find_monitor(id: u32) -> AppResult<Monitor> {
    Monitor::all()
        .map_err(|e| AppError::message(e.to_string()))?
        .into_iter()
        .find(|monitor| monitor.id().ok() == Some(id))
        .ok_or(AppError::NotFound("Monitor não encontrado"))
}

pub fn cursor_pos() -> (i32, i32) {
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

pub fn collect_windows() -> Vec<ScreenshotWindowInfo> {
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
            if title == "MediaKit" || title == "Selecionar área" {
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
    windows.sort_by_key(|a| std::cmp::Reverse(a.0));
    windows.into_iter().map(|(_, info)| info).collect()
}
