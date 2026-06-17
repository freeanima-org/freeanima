use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, RunEvent, WebviewWindow,
};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

pub mod bootstrap;

static SIDECAR_PORT: AtomicU16 = AtomicU16::new(4176);
static CLICKTHROUGH: AtomicBool = AtomicBool::new(false);
static POINTER_ACTIVE: AtomicBool = AtomicBool::new(false);

struct SidecarState {
    child: Mutex<Option<CommandChild>>,
}

impl SidecarState {
    fn new() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

fn stop_sidecar(app: &AppHandle) {
    log_line("stopping companion sidecar…");
    if let Some(state) = app.try_state::<SidecarState>() {
        if let Ok(mut guard) = state.child.lock() {
            if let Some(child) = guard.take() {
                if let Err(err) = child.kill() {
                    log_line(&format!("sidecar kill error: {err}"));
                }
            }
        }
    }
    force_kill_sidecar_process();
}

#[cfg(windows)]
fn force_kill_sidecar_process() {
    for name in [
        "companion-sidecar.exe",
        "companion-sidecar-x86_64-pc-windows-gnu.exe",
    ] {
        let status = std::process::Command::new("taskkill")
            .args(["/F", "/IM", name, "/T"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
        if let Ok(st) = status {
            if st.success() {
                log_line(&format!("taskkill {name} ok"));
            }
        }
    }
}

#[cfg(not(windows))]
fn force_kill_sidecar_process() {}

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
fn set_pointer_active(active: bool) -> Result<(), String> {
    POINTER_ACTIVE.store(active, Ordering::SeqCst);
    Ok(())
}

fn effective_clickthrough(ignore: bool) -> bool {
    if POINTER_ACTIVE.load(Ordering::SeqCst) {
        return false;
    }
    // WebView2 透明窗在动态穿透下易出现整窗无法点击/拖拽
    #[cfg(windows)]
    {
        let _ = ignore;
        return false;
    }
    #[cfg(not(windows))]
    {
        ignore
    }
}

#[tauri::command]
fn move_window(window: WebviewWindow, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(PhysicalPosition::new(x as i32, y as i32))
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PatrolScreenInfo {
    avail_left: i32,
    avail_top: i32,
    avail_width: u32,
    avail_height: u32,
    window_width: u32,
    window_height: u32,
}

/// 当前显示器工作区 + 窗口外框尺寸（物理像素，与 move_window 一致）
#[tauri::command]
fn get_patrol_screen(window: WebviewWindow) -> Result<PatrolScreenInfo, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let work = monitor.work_area();
    let size = window.outer_size().map_err(|e| e.to_string())?;
    Ok(PatrolScreenInfo {
        avail_left: work.position.x,
        avail_top: work.position.y,
        avail_width: work.size.width,
        avail_height: work.size.height,
        window_width: size.width,
        window_height: size.height,
    })
}

#[tauri::command]
fn get_window_position(window: WebviewWindow) -> Result<[i32; 2], String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok([pos.x, pos.y])
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
fn toggle_companion_visibility(app: AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("companion")
        .ok_or("companion window not found")?;
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

    let (mut rx, child) = sidecar.spawn().map_err(|e| e.to_string())?;
    if let Some(state) = app.try_state::<SidecarState>() {
        if let Ok(mut guard) = state.child.lock() {
            *guard = Some(child);
        }
    } else {
        log_line("warn: SidecarState missing; sidecar may outlive shell");
    }
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
            if let Ok(pos) = win.cursor_position() {
                // cursor_position 为物理像素；WebView DOM / hitTest 使用逻辑像素
                let scale = win.scale_factor().unwrap_or(1.0);
                let logical_x = pos.x / scale;
                let logical_y = pos.y / scale;
                let _ = win.emit(
                    "cursor-position",
                    serde_json::json!({ "x": logical_x, "y": logical_y }),
                );

                let ignore = effective_clickthrough(CLICKTHROUGH.load(Ordering::SeqCst));
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

    let app = match tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            log_line("companion shell setup start");
            app.manage(SidecarState::new());

            let companion_window = app
                .get_webview_window("companion")
                .or_else(|| app.webview_windows().values().next().cloned())
                .ok_or("no companion window")?;

            if let Err(err) = spawn_sidecar(&app.handle()) {
                let msg = format!(
                    "后台服务启动失败：{err}\n\n日志：%USERPROFILE%\\.anima\\companion\\shell.log"
                );
                log_line(&msg);
                show_native_error("FreeAnima Companion", &msg);
            }

            start_cursor_poll(companion_window.clone());
            let _ = companion_window.show();
            let _ = companion_window.set_focus();

            let toggle_companion =
                MenuItem::with_id(app, "toggle_companion", "显示/隐藏伴侣", true, None::<&str>)
                    .map_err(|e| e.to_string())?;
            let settings = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let menu = Menu::with_items(app, &[&toggle_companion, &settings, &quit])
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
                        "quit" => {
                            stop_sidecar(app);
                            app.exit(0);
                        }
                        "settings" => {
                            let _ = open_settings(app.clone());
                        }
                        "toggle_companion" => {
                            let _ = toggle_companion_visibility(app.clone());
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
                        if let Some(window) = tray.app_handle().get_webview_window("companion") {
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
            set_pointer_active,
            move_window,
            start_drag,
            get_sidecar_port,
            get_patrol_screen,
            get_window_position,
            open_settings,
            toggle_companion_visibility
        ])
        .build(tauri::generate_context!())
    {
        Ok(app) => app,
        Err(err) => {
            bootstrap::fatal_startup(&format!(
                "Tauri 启动失败：{err}\n\n常见原因：未安装 WebView2 运行时。\n请安装 https://go.microsoft.com/fwlink/p/?LinkId=2124703\n\n日志：%USERPROFILE%\\.anima\\companion\\shell.log"
            ));
        }
    };

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            stop_sidecar(app_handle);
        }
    });
}
