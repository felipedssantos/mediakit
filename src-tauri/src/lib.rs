mod commands;
mod desktop;
mod error;
mod features;
mod manager;
mod presets;
mod probe;
mod progress;
mod queue;
mod screenshot;
mod sidecar;
mod types;
mod worker;
mod youtube;

use std::sync::atomic::Ordering;

use desktop::AppLifecycle;
use manager::JobManager;
use screenshot::ScreenshotState;
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};
use youtube::YoutubeManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            desktop::show_main(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if !features::SCREENSHOT_ENABLED {
                        return;
                    }
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = crate::screenshot::start_snip_overlay(app).await;
                    });
                })
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(AppLifecycle::new());
            app.manage(JobManager::new(handle.clone()));
            app.manage(YoutubeManager::new(handle));
            app.manage(youtube::cookies::CookieCache::new());
            app.manage(ScreenshotState::new());

            if features::SCREENSHOT_ENABLED {
                if let Err(err) = screenshot::ensure_overlay(app.handle()) {
                    eprintln!("Não foi possível preparar o overlay de print: {err}");
                }

                if let Err(err) = app
                    .global_shortcut()
                    .register(Shortcut::new(None, Code::PrintScreen))
                {
                    eprintln!("Não foi possível registrar Print Screen: {err}");
                }
            }

            if let Err(err) = desktop::setup_tray(app.handle()) {
                eprintln!("Não foi possível criar o ícone da bandeja: {err}");
            }

            use tauri_plugin_autostart::ManagerExt;
            if let Err(err) = app.autolaunch().enable() {
                eprintln!("Não foi possível ativar a inicialização com o Windows: {err}");
            }

            let started_with_windows = std::env::args().any(|arg| arg == "--autostart");
            if started_with_windows {
                desktop::hide_to_tray(app.handle());
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                let quitting = window
                    .app_handle()
                    .state::<AppLifecycle>()
                    .quitting
                    .load(Ordering::SeqCst);
                if !quitting {
                    api.prevent_close();
                    desktop::hide_to_tray(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::probe_media,
            commands::add_job,
            commands::add_jobs,
            commands::cancel_job,
            commands::retry_job,
            commands::get_jobs,
            commands::set_max_concurrency,
            commands::get_max_concurrency,
            commands::detect_hw,
            commands::suggest_output_path,
            commands::probe_youtube,
            commands::add_youtube_download,
            commands::cancel_youtube_download,
            commands::retry_youtube_download,
            commands::get_youtube_downloads,
            commands::default_download_dir,
            screenshot::commands::list_screenshot_monitors,
            screenshot::commands::list_screenshot_windows,
            screenshot::commands::capture_monitor,
            screenshot::commands::capture_window,
            screenshot::commands::begin_region_capture,
            screenshot::commands::get_region_session,
            screenshot::commands::commit_snip_capture,
            screenshot::commands::crop_screenshot,
            screenshot::commands::finish_fullscreen_capture,
            screenshot::commands::cancel_region_capture,
            screenshot::commands::copy_screenshot,
            screenshot::commands::save_screenshot,
            screenshot::commands::default_picture_dir,
            screenshot::commands::list_screenshot_history,
            screenshot::commands::delete_screenshot_history,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                let quitting = app.state::<AppLifecycle>().quitting.load(Ordering::SeqCst);
                if !quitting {
                    api.prevent_exit();
                }
            }
        });
}
