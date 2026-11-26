use xcap::Window;

use crate::screenshot::ScreenshotWindowInfo;

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

fn map_window(window: &Window) -> Option<ScreenshotWindowInfo> {
    if window.is_minimized().unwrap_or(true) {
        return None;
    }
    let width = window.width().unwrap_or(0);
    let height = window.height().unwrap_or(0);
    if width < 32 || height < 32 {
        return None;
    }
    let title = window.title().unwrap_or_default();
    if title == "MediaKit" || title == "Selecionar área" {
        return None;
    }
    // Only query app_name when title is empty to avoid expensive process/version lookups.
    let app_name = if title.trim().is_empty() {
        window.app_name().unwrap_or_default()
    } else {
        String::new()
    };
    if title.trim().is_empty() && app_name.trim().is_empty() {
        return None;
    }
    let resolved_title = if title.trim().is_empty() {
        app_name.clone()
    } else {
        title
    };
    Some(ScreenshotWindowInfo {
        id: window.id().ok()?,
        title: resolved_title,
        app_name,
        width,
        height,
        x: window.x().unwrap_or(0),
        y: window.y().unwrap_or(0),
    })
}

pub fn collect_windows() -> Vec<ScreenshotWindowInfo> {
    let raw = Window::all().unwrap_or_default();
    #[cfg(windows)]
    {
        // EnumWindows on Windows already returns windows in top-to-bottom Z-order.
        raw.iter().filter_map(map_window).collect()
    }
    #[cfg(not(windows))]
    {
        let mut windows = raw
            .iter()
            .filter_map(|window| Some((window.z().unwrap_or(0), map_window(window)?)))
            .collect::<Vec<_>>();
        windows.sort_by_key(|a| std::cmp::Reverse(a.0));
        windows.into_iter().map(|(_, info)| info).collect()
    }
}
