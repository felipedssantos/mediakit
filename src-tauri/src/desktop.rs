use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::features;

pub struct AppLifecycle {
    pub quitting: AtomicBool,
}

impl AppLifecycle {
    pub fn new() -> Self {
        Self {
            quitting: AtomicBool::new(false),
        }
    }
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_skip_taskbar(false);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn hide_to_tray(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        let _ = window.set_skip_taskbar(true);
    }
}

pub fn quit(app: &AppHandle) {
    app.state::<AppLifecycle>()
        .quitting
        .store(true, Ordering::SeqCst);
    app.exit(0);
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Abrir Conversor", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;

    let menu = if features::SCREENSHOT_ENABLED {
        let print = MenuItem::with_id(app, "print", "Print screen", true, None::<&str>)?;
        Menu::with_items(app, &[&open, &print, &sep, &quit_item])?
    } else {
        Menu::with_items(app, &[&open, &sep, &quit_item])?
    };

    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Conversor")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "print" if features::SCREENSHOT_ENABLED => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::screenshot::start_snip_overlay(app).await;
                });
            }
            "quit" => quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}
