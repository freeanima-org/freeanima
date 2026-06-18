use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, Manager, RunEvent, WebviewWindow,
};

pub mod bootstrap;

static SIDECAR_PORT: AtomicU16 = AtomicU16::new(4176);
static CLICKTHROUGH: AtomicBool = AtomicBool::new(false);
static POINTER_ACTIVE: AtomicBool = AtomicBool::new(false);

struct SidecarState {
    child: Mutex<Option<Child>>,
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
            if let Some(mut child) = guard.take() {
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
    for name in ["companion-bun.exe"] {
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
fn force_kill_sidecar_process() {
    let _ = Command::new("pkill").args(["-f", "companion-bun"]).status();
}

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
        .set_position(LogicalPosition::new(x, y))
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

/// 当前显示器工作区 + 窗口外框尺寸（逻辑像素，与 tauri.conf 及 WebView 坐标一致）
#[tauri::command]
fn get_patrol_screen(window: WebviewWindow) -> Result<PatrolScreenInfo, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let work_area = monitor.work_area();
    let work_pos = work_area.position.to_logical::<i32>(scale);
    let work_size = work_area.size.to_logical::<u32>(scale);
    let size = window
        .outer_size()
        .map_err(|e| e.to_string())?
        .to_logical::<u32>(scale);
    Ok(PatrolScreenInfo {
        avail_left: work_pos.x,
        avail_top: work_pos.y,
        avail_width: work_size.width,
        avail_height: work_size.height,
        window_width: size.width,
        window_height: size.height,
    })
}

#[tauri::command]
fn get_window_position(window: WebviewWindow) -> Result<[i32; 2], String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let logical = pos.to_logical::<i32>(scale);
    Ok([logical.x, logical.y])
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

fn exe_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
}

fn bundled_bun_path() -> Option<PathBuf> {
    let dir = exe_dir()?;
    #[cfg(windows)]
    {
        let plain = dir.join("companion-bun.exe");
        if plain.is_file() {
            return Some(plain);
        }
    }
    #[cfg(not(windows))]
    {
        let plain = dir.join("companion-bun");
        if plain.is_file() {
            return Some(plain);
        }
    }
    None
}

#[cfg(unix)]
fn bun_from_path() -> Option<PathBuf> {
    let output = Command::new("which").arg("bun").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(PathBuf::from(path))
    }
}

#[cfg(windows)]
fn bun_from_path() -> Option<PathBuf> {
    let output = Command::new("where").arg("bun").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()?
        .trim()
        .to_string();
    if path.is_empty() {
        None
    } else {
        Some(PathBuf::from(path))
    }
}

fn resolve_bun_executable() -> Result<PathBuf, String> {
    bundled_bun_path()
        .or_else(bun_from_path)
        .ok_or_else(|| "未找到 companion-bun 或系统 PATH 中的 bun".to_string())
}

fn resolve_sidecar_launch(app: &AppHandle) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let bundled_root = resource_dir.join("sidecar");
    let bundled_entry = bundled_root.join("server").join("index.ts");

    if bundled_entry.is_file() {
        return Ok((resolve_bun_executable()?, bundled_entry, bundled_root));
    }

    let dev_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let dev_entry = dev_root.join("server").join("index.ts");
    if dev_entry.is_file() {
        return Ok((resolve_bun_executable()?, dev_entry, dev_root));
    }

    Err(format!(
        "未找到 sidecar 入口（已检查 {} 与 {}）",
        bundled_entry.display(),
        dev_entry.display()
    ))
}

fn apply_sidecar_port(app: &AppHandle, port: u16) {
    SIDECAR_PORT.store(port, Ordering::SeqCst);
    let _ = app.emit("sidecar-ready", port);
}

fn parse_sidecar_port_line(line: &str) -> Option<u16> {
    let trimmed = line.trim();
    if let Some(rest) = trimmed.strip_prefix("companion-sidecar-port:") {
        return rest.trim().parse().ok();
    }
    if let Some(rest) = trimmed.strip_prefix("companion satellite http://127.0.0.1:") {
        return rest.trim().parse().ok();
    }
    None
}

fn sidecar_log_line(app: &AppHandle, stream: &str, line: &str) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return;
    }
    log_line(&format!("sidecar {stream}: {trimmed}"));
    if let Some(port) = parse_sidecar_port_line(trimmed) {
        apply_sidecar_port(app, port);
    }
    if stream == "stderr" && trimmed.starts_with("companion-sidecar-fatal:") {
        let _ = app.emit("sidecar-error", trimmed);
    }
}

fn watch_sidecar_process(app: AppHandle) {
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_millis(400));
            let exited = (|| {
                let state = app.try_state::<SidecarState>()?;
                let mut guard = state.child.lock().ok()?;
                let child = guard.as_mut()?;
                child.try_wait().ok().and_then(|status| status)
            })();
            if let Some(status) = exited {
                if !status.success() {
                    let msg = format!(
                        "后台进程异常退出（{status}）。若被杀毒软件拦截，请将安装目录下的 companion-bun.exe 加入白名单。"
                    );
                    log_line(&msg);
                    let _ = app.emit("sidecar-error", msg);
                }
                break;
            }
        }
    });
}

fn spawn_sidecar(app: &AppHandle) -> Result<(), String> {
    log_line("spawning companion sidecar (bun + server/index.ts)…");
    let (bun, entry, cwd) = resolve_sidecar_launch(app)?;
    log_line(&format!(
        "sidecar launch: bun={} entry={} cwd={}",
        bun.display(),
        entry.display(),
        cwd.display()
    ));

    let mut cmd = Command::new(&bun);
    cmd.arg(&entry)
        .current_dir(&cwd)
        .env("SATELLITE_PORT", "4176")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("启动 sidecar 失败: {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(state) = app.try_state::<SidecarState>() {
        if let Ok(mut guard) = state.child.lock() {
            *guard = Some(child);
        }
    } else {
        log_line("warn: SidecarState missing; sidecar may outlive shell");
    }
    log_line("companion sidecar process started");
    watch_sidecar_process(app.clone());

    let app_handle = app.clone();
    if let Some(out) = stdout {
        thread::spawn(move || {
            let reader = BufReader::new(out);
            for line in reader.lines().map_while(Result::ok) {
                sidecar_log_line(&app_handle, "stdout", &line);
            }
        });
    }

    let app_handle = app.clone();
    if let Some(err) = stderr {
        thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                sidecar_log_line(&app_handle, "stderr", &line);
            }
        });
    }

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
