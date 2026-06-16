use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow,
};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

static SIDECAR_PORT: AtomicU16 = AtomicU16::new(4176);
static CLICKTHROUGH: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn set_clickthrough(ignore: bool) -> Result<(), String> {
    CLICKTHROUGH.store(ignore, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn move_window(window: WebviewWindow, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(PhysicalPosition::new(x as i32, y as i32))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn start_drag(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sidecar_port() -> u16 {
    SIDECAR_PORT.load(Ordering::SeqCst)
}

fn spawn_sidecar(app: &AppHandle) -> Result<(), String> {
    let sidecar = app
        .shell()
        .sidecar("bin/companion-sidecar")
        .map_err(|e| e.to_string())?;

    let (mut rx, _child) = sidecar.spawn().map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    thread::spawn(move || {
        while let Some(event) = rx.blocking_recv() {
            if let CommandEvent::Stdout(line) = event {
                let text = String::from_utf8_lossy(&line);
                if let Some(port_str) = text.strip_prefix("companion satellite http://127.0.0.1:") {
                    if let Ok(port) = port_str.trim().parse::<u16>() {
                        SIDECAR_PORT.store(port, Ordering::SeqCst);
                        let _ = app_handle.emit("sidecar-ready", port);
                    }
                }
            }
        }
    });

    Ok(())
}

fn start_cursor_poll(window: WebviewWindow) {
    let win = Arc::new(window);
    thread::spawn(move || {
        loop {
            if let (Ok(pos), Ok(outer)) = (win.cursor_position(), win.outer_position()) {
                let global_x = outer.x as f64 + pos.x;
                let global_y = outer.y as f64 + pos.y;
                let _ = win.emit(
                    "cursor-position",
                    serde_json::json!({ "x": global_x, "y": global_y }),
                );

                let ignore = CLICKTHROUGH.load(Ordering::SeqCst);
                let _ = win.set_ignore_cursor_events(ignore);
            }
            thread::sleep(Duration::from_millis(16));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .or_else(|| app.webview_windows().values().next().cloned())
                .ok_or("no main window")?;

            spawn_sidecar(&app.handle())?;
            start_cursor_poll(window.clone());

            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let menu = Menu::with_items(app, &[&quit]).map_err(|e| e.to_string())?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "quit" {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)
                .map_err(|e| e.to_string())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_clickthrough,
            move_window,
            start_drag,
            get_sidecar_port
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
