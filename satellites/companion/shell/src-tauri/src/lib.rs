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

pub mod bootstrap;

static SIDECAR_PORT: AtomicU16 = AtomicU16::new(4176);
static CLICKTHROUGH: AtomicBool = AtomicBool::new(false);

fn log_line(msg: &str) {
    bootstrap::log_line(msg);
}

fn show_native_error(title: &str, message: &str) {
    bootstrap::show_native_error(title, message);
}

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

#[tauri::command]
fn open_settings(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or("settings window not found")?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn toggle_pet_visibility(app: AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("pet")
        .ok_or("pet window not found")?;
    let visible = window.is_visible().map_err(|e| e.to_string())?;
    if visible {
        window.hide().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

fn tray_icon(app: &tauri::App) -> Option<tauri::image::Image<'_>> {
    app.default_window_icon()
        .cloned()
        .or_else(|| Some(tauri::include_image!("icons/32x32.png")))
}

fn spawn_sidecar(app: &AppHandle) -> Result<(), String> {
    log_line("spawning companion sidecar…");
    let sidecar = app
        .shell()
        .sidecar("companion-sidecar")
        .map_err(|e| {
            let hint = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join("companion-sidecar.exe")))
                .map(|path| format!("\n期望路径：{}", path.display()))
                .unwrap_or_default();
            format!("{e}{hint}")
        })?;

    let (mut rx, _child) = sidecar.spawn().map_err(|e| e.to_string())?;
    log_line("companion sidecar process started");

    let app_handle = app.clone();
    thread::spawn(move || {
        while let Some(event) = rx.blocking_recv() {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log_line(&format!("sidecar stdout: {}", text.trim()));
                    if let Some(port_str) =
                        text.strip_prefix("companion satellite http://127.0.0.1:")
                    {
                        if let Ok(port) = port_str.trim().parse::<u16>() {
                            SIDECAR_PORT.store(port, Ordering::SeqCst);
                            let _ = app_handle.emit("sidecar-ready", port);
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log_line(&format!("sidecar stderr: {}", text.trim()));
                }
                CommandEvent::Error(err) => {
                    log_line(&format!("sidecar error: {err}"));
                    let _ = app_handle.emit("sidecar-error", err.to_string());
                }
                CommandEvent::Terminated(payload) => {
                    log_line(&format!("sidecar terminated: {payload:?}"));
                    let _ = app_handle.emit("sidecar-error", format!("后台进程已退出: {payload:?}"));
                }
                _ => {}
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
    bootstrap::install_panic_hook();
    log_line("companion shell run start");

    if let Err(err) = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            log_line("companion shell setup start");
            let pet_window = app
                .get_webview_window("pet")
                .or_else(|| app.webview_windows().values().next().cloned())
                .ok_or("no pet window")?;

            if let Err(err) = spawn_sidecar(&app.handle()) {
                let msg = format!(
                    "后台服务启动失败：{err}\n\n日志：%USERPROFILE%\\.anima\\companion\\shell.log"
                );
                log_line(&msg);
                show_native_error("FreeAnima Companion", &msg);
            }

            start_cursor_poll(pet_window.clone());
            let _ = pet_window.center();
            let _ = pet_window.show();
            let _ = pet_window.set_focus();

            let toggle_pet = MenuItem::with_id(app, "toggle_pet", "显示/隐藏桌宠", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let settings = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let menu = Menu::with_items(app, &[&toggle_pet, &settings, &quit])
                .map_err(|e| e.to_string())?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("FreeAnima Companion");
            if let Some(icon) = tray_icon(app) {
                tray_builder = tray_builder.icon(icon);
            }
            match tray_builder
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "settings" => {
                            let _ = open_settings(app.clone());
                        }
                        "toggle_pet" => {
                            let _ = toggle_pet_visibility(app.clone());
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("pet") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)
            {
                Ok(_) => log_line("tray icon created"),
                Err(err) => log_line(&format!("tray icon failed (non-fatal): {err}")),
            }

            log_line("companion shell setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_clickthrough,
            move_window,
            start_drag,
            get_sidecar_port,
            open_settings,
            toggle_pet_visibility
        ])
        .run(tauri::generate_context!())
    {
        bootstrap::fatal_startup(&format!(
            "Tauri 启动失败：{err}\n\n常见原因：未安装 WebView2 运行时。\n请安装 https://go.microsoft.com/fwlink/p/?LinkId=2124703\n\n日志：%USERPROFILE%\\.anima\\companion\\shell.log"
        ));
    }
}
