//! FreeAnima Portal — Tauri host（桌面：主窗 + companion；移动：单 WebView + 小组件）。

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(desktop)]
use tauri::path::BaseDirectory;
#[cfg(desktop)]
use tauri::{PhysicalPosition, WebviewUrl, WebviewWindowBuilder};
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[cfg(desktop)]
const COMPANION_W: f64 = 160.0;
#[cfg(desktop)]
const COMPANION_H: f64 = 260.0;
const DEFAULT_HABITAT: &str = "http://127.0.0.1:2658";
const SHELL_PREFS_FILE: &str = "desktop-shell.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedShellPrefs {
  #[serde(default)]
  habitat_url: String,
  #[serde(default)]
  remote_auth_token: String,
  #[serde(default = "default_companion_visible")]
  companion_visible: bool,
}

fn default_companion_visible() -> bool {
  true
}

fn anima_home() -> std::path::PathBuf {
  if let Ok(h) = std::env::var("FREEANIMA_HOME") {
    return std::path::PathBuf::from(h);
  }
  let mut h = dirs_next_home();
  h.push(".anima");
  h
}

/// 桌面：`~/.anima`；移动：应用私有 config 目录（Android 上 HOME 常为只读）。
fn shell_prefs_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  #[cfg(mobile)]
  {
    let dir = app
      .path()
      .app_config_dir()
      .map_err(|e| format!("app_config_dir: {e}"))?;
    Ok(dir.join(SHELL_PREFS_FILE))
  }
  #[cfg(desktop)]
  {
    let _ = app;
    Ok(anima_home().join(SHELL_PREFS_FILE))
  }
}

fn load_shell_prefs_from(path: &std::path::Path) -> PersistedShellPrefs {
  if !path.exists() {
    return PersistedShellPrefs {
      habitat_url: DEFAULT_HABITAT.to_string(),
      companion_visible: true,
      ..Default::default()
    };
  }
  match std::fs::read_to_string(path) {
    Ok(raw) => serde_json::from_str(&raw).unwrap_or_else(|_| PersistedShellPrefs {
      habitat_url: DEFAULT_HABITAT.to_string(),
      companion_visible: true,
      ..Default::default()
    }),
    Err(_) => PersistedShellPrefs {
      habitat_url: DEFAULT_HABITAT.to_string(),
      companion_visible: true,
      ..Default::default()
    },
  }
}

fn load_shell_prefs() -> PersistedShellPrefs {
  // 无 AppHandle 时（进程启动）：桌面可读 ~/.anima；移动端先默认，setup 再从 app_config_dir 覆盖。
  #[cfg(mobile)]
  {
    return PersistedShellPrefs {
      habitat_url: DEFAULT_HABITAT.to_string(),
      companion_visible: true,
      ..Default::default()
    };
  }
  #[cfg(desktop)]
  {
    load_shell_prefs_from(&anima_home().join(SHELL_PREFS_FILE))
  }
}

fn save_shell_prefs(app: &AppHandle, prefs: &PersistedShellPrefs) -> Result<(), String> {
  let path = shell_prefs_path(app)?;
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
  }
  let body = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
  std::fs::write(&path, body).map_err(|e| e.to_string())
}

#[cfg(mobile)]
fn apply_loaded_prefs_to_state(state: &ShellState, prefs: &PersistedShellPrefs) {
  let habitat_url = if prefs.habitat_url.trim().is_empty() {
    DEFAULT_HABITAT.to_string()
  } else {
    prefs.habitat_url.trim().trim_end_matches('/').to_string()
  };
  *state.habitat.lock().expect("habitat lock") = HabitatClientConfig {
    habitat_url,
    remote_auth_token: prefs.remote_auth_token.clone(),
  };
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HabitatClientConfig {
  pub habitat_url: String,
  pub remote_auth_token: String,
}

#[cfg(desktop)]
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub struct RemoteToolsStatus {
  pub instance_id: String,
  pub remote_tools_connected: bool,
}

#[cfg(desktop)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatrolScreenInfo {
  pub avail_left: i32,
  pub avail_top: i32,
  pub avail_width: u32,
  pub avail_height: u32,
  pub window_width: u32,
  pub window_height: u32,
}

#[cfg(desktop)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenPoint {
  pub x: i32,
  pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAlertPayload {
  pub title: String,
  pub body: Option<String>,
  pub silent: Option<bool>,
}

struct ShellState {
  #[cfg(desktop)]
  companion_visible: Mutex<bool>,
  #[cfg(desktop)]
  clickthrough: Mutex<bool>,
  #[cfg(desktop)]
  pointer_active: Mutex<bool>,
  #[cfg(desktop)]
  remote_tools: Mutex<RemoteToolsStatus>,
  habitat: Mutex<HabitatClientConfig>,
  pomodoro: Mutex<PomodoroWidgetState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroWidgetState {
  pub phase: String,
  pub remaining_sec: u64,
  pub task_title: Option<String>,
}

impl Default for ShellState {
  fn default() -> Self {
    let prefs = load_shell_prefs();
    let habitat_url = if prefs.habitat_url.trim().is_empty() {
      DEFAULT_HABITAT.to_string()
    } else {
      prefs.habitat_url.trim().trim_end_matches('/').to_string()
    };
    Self {
      #[cfg(desktop)]
      companion_visible: Mutex::new(prefs.companion_visible),
      #[cfg(desktop)]
      clickthrough: Mutex::new(false),
      #[cfg(desktop)]
      pointer_active: Mutex::new(false),
      #[cfg(desktop)]
      remote_tools: Mutex::new(RemoteToolsStatus::default()),
      habitat: Mutex::new(HabitatClientConfig {
        habitat_url,
        remote_auth_token: prefs.remote_auth_token,
      }),
      pomodoro: Mutex::new(PomodoroWidgetState {
        phase: "idle".into(),
        remaining_sec: 0,
        task_title: None,
      }),
    }
  }
}

#[cfg(desktop)]
fn companion_url(app: &AppHandle) -> WebviewUrl {
  if let Ok(overlay) = std::env::var("COMPANION_OVERLAY_URL") {
    if let Ok(parsed) = overlay.parse() {
      return WebviewUrl::External(parsed);
    }
  }
  if let Ok(dir) = app.path().resolve("companion-dist", BaseDirectory::Resource) {
    let index = dir.join("index.html");
    if index.exists() {
      if let Ok(mut url) = url::Url::from_file_path(&index) {
        url.set_query(Some("view=overlay"));
        return WebviewUrl::External(url);
      }
    }
  }
  WebviewUrl::External(
    "http://127.0.0.1:4176/?view=overlay"
      .parse()
      .expect("companion overlay url"),
  )
}

#[cfg(desktop)]
fn webview_browser_args() -> &'static str {
  "--host-resolver-rules=MAP tauri.localhost 127.0.0.1,MAP ipc.localhost 127.0.0.1 --dns-over-https-mode=off"
}

#[cfg(desktop)]
fn ensure_companion(app: &AppHandle) -> Result<(), String> {
  if app.get_webview_window("companion").is_some() {
    return Ok(());
  }
  let url = companion_url(app);
  let mut builder = WebviewWindowBuilder::new(app, "companion", url)
    .title("")
    .inner_size(COMPANION_W, COMPANION_H)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false);
  #[cfg(windows)]
  {
    builder = builder.additional_browser_args(webview_browser_args());
  }
  builder.build().map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn get_habitat_config(state: State<'_, ShellState>) -> HabitatClientConfig {
  state.habitat.lock().expect("habitat lock").clone()
}

#[tauri::command]
fn set_habitat_config(
  app: AppHandle,
  state: State<'_, ShellState>,
  habitat_url: String,
  remote_auth_token: String,
) -> Result<(), String> {
  let url = habitat_url.trim().trim_end_matches('/').to_string();
  let cfg = HabitatClientConfig {
    habitat_url: if url.is_empty() {
      DEFAULT_HABITAT.to_string()
    } else {
      url
    },
    remote_auth_token,
  };
  *state.habitat.lock().expect("habitat lock") = cfg.clone();
  #[cfg(desktop)]
  let visible = *state.companion_visible.lock().expect("cv");
  #[cfg(not(desktop))]
  let visible = true;
  save_shell_prefs(
    &app,
    &PersistedShellPrefs {
      habitat_url: cfg.habitat_url,
      remote_auth_token: cfg.remote_auth_token,
      companion_visible: visible,
    },
  )?;
  let _ = app.emit("shell:config-changed", ());
  Ok(())
}

#[tauri::command]
fn open_settings(app: AppHandle) -> Result<(), String> {
  if let Some(main) = app.get_webview_window("main") {
    let _ = main.show();
    let _ = main.set_focus();
    let _ = main.eval("window.location.hash = '#/settings'");
  }
  Ok(())
}

#[tauri::command]
fn set_pomodoro_widget_state(state: State<'_, ShellState>, payload: PomodoroWidgetState) {
  *state.pomodoro.lock().expect("pomodoro lock") = payload;
}

#[tauri::command]
fn get_pomodoro_widget_state(state: State<'_, ShellState>) -> PomodoroWidgetState {
  state.pomodoro.lock().expect("pomodoro lock").clone()
}

#[cfg(desktop)]
#[tauri::command]
fn set_click_through(app: AppHandle, state: State<'_, ShellState>, ignore: bool) -> Result<(), String> {
  *state.clickthrough.lock().expect("ct") = ignore;
  if let Some(win) = app.get_webview_window("companion") {
    let pointer = *state.pointer_active.lock().expect("pa");
    let effective = ignore && !pointer;
    win.set_ignore_cursor_events(effective).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn set_pointer_active(app: AppHandle, state: State<'_, ShellState>, active: bool) -> Result<(), String> {
  *state.pointer_active.lock().expect("pa") = active;
  let ignore = *state.clickthrough.lock().expect("ct");
  if let Some(win) = app.get_webview_window("companion") {
    win
      .set_ignore_cursor_events(ignore && !active)
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn move_companion_window(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
  if let Some(win) = app.get_webview_window("companion") {
    win
      .set_position(tauri::Position::Physical(PhysicalPosition { x, y }))
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn get_companion_position(app: AppHandle) -> Result<ScreenPoint, String> {
  let win = app
    .get_webview_window("companion")
    .ok_or_else(|| "companion window not found".to_string())?;
  let pos = win.outer_position().map_err(|e| e.to_string())?;
  Ok(ScreenPoint { x: pos.x, y: pos.y })
}

#[cfg(desktop)]
#[tauri::command]
fn get_patrol_screen(app: AppHandle) -> Result<PatrolScreenInfo, String> {
  let win = app
    .get_webview_window("companion")
    .ok_or_else(|| "companion window not found".to_string())?;
  let size = win.outer_size().map_err(|e| e.to_string())?;
  let monitor = win
    .current_monitor()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "no monitor".to_string())?;
  let area = monitor.work_area();
  Ok(PatrolScreenInfo {
    avail_left: area.position.x,
    avail_top: area.position.y,
    avail_width: area.size.width,
    avail_height: area.size.height,
    window_width: size.width,
    window_height: size.height,
  })
}

#[cfg(desktop)]
#[tauri::command]
fn get_cursor_position() -> ScreenPoint {
  use mouse_position::mouse_position::Mouse;
  match Mouse::get_mouse_position() {
    Mouse::Position { x, y } => ScreenPoint { x, y },
    Mouse::Error => ScreenPoint { x: 0, y: 0 },
  }
}

#[cfg(desktop)]
#[tauri::command]
fn start_companion_drag(app: AppHandle) -> Result<(), String> {
  if let Some(win) = app.get_webview_window("companion") {
    win.start_dragging().map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn get_companion_visible(state: State<'_, ShellState>) -> bool {
  *state.companion_visible.lock().expect("cv")
}

#[cfg(desktop)]
#[tauri::command]
fn set_companion_visible(app: AppHandle, state: State<'_, ShellState>, visible: bool) -> Result<(), String> {
  *state.companion_visible.lock().expect("cv") = visible;
  let habitat = state.habitat.lock().expect("habitat lock").clone();
  save_shell_prefs(
    &app,
    &PersistedShellPrefs {
      habitat_url: habitat.habitat_url,
      remote_auth_token: habitat.remote_auth_token,
      companion_visible: visible,
    },
  )?;
  ensure_companion(&app)?;
  if let Some(win) = app.get_webview_window("companion") {
    if visible {
      win.show().map_err(|e| e.to_string())?;
    } else {
      win.hide().map_err(|e| e.to_string())?;
    }
  }
  Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn report_remote_tools_status(state: State<'_, ShellState>, status: RemoteToolsStatus) {
  *state.remote_tools.lock().expect("rt") = status;
}

#[cfg(desktop)]
#[tauri::command]
fn get_remote_tools_status(state: State<'_, ShellState>) -> RemoteToolsStatus {
  state.remote_tools.lock().expect("rt").clone()
}

#[tauri::command]
fn show_native_alert(app: AppHandle, payload: NativeAlertPayload) -> Result<(), String> {
  use tauri_plugin_notification::NotificationExt;
  let mut n = app.notification().builder().title(payload.title);
  if let Some(body) = payload.body {
    n = n.body(body);
  }
  n.show().map_err(|e| e.to_string())?;
  let _ = payload.silent;
  Ok(())
}

#[tauri::command]
fn instance_load(app: AppHandle, app_id: String) -> Result<Option<String>, String> {
  let path = instance_json_path(&app, &app_id)?;
  if !path.exists() {
    return Ok(None);
  }
  let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
  let v: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
  Ok(v.get("instanceId").and_then(|x| x.as_str()).map(|s| s.to_string()))
}

#[tauri::command]
fn instance_save(app: AppHandle, app_id: String, instance_id: String) -> Result<(), String> {
  let path = instance_json_path(&app, &app_id)?;
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
  }
  let body = serde_json::json!({ "instanceId": instance_id });
  std::fs::write(path, body.to_string()).map_err(|e| e.to_string())?;
  Ok(())
}

fn instance_json_path(app: &AppHandle, app_id: &str) -> Result<std::path::PathBuf, String> {
  #[cfg(mobile)]
  {
    let dir = app
      .path()
      .app_data_dir()
      .map_err(|e| format!("app_data_dir: {e}"))?
      .join("satellites")
      .join(app_id);
    Ok(dir.join("instance.json"))
  }
  #[cfg(desktop)]
  {
    let _ = app;
    let home = std::env::var("FREEANIMA_HOME").unwrap_or_else(|_| {
      let mut h = dirs_next_home();
      h.push(".anima");
      h.to_string_lossy().into_owned()
    });
    Ok(
      std::path::PathBuf::from(home)
        .join("satellites")
        .join(app_id)
        .join("instance.json"),
    )
  }
}

#[tauri::command]
async fn probe_habitat_health(
  url: String,
  token: Option<String>,
  timeout_ms: Option<u64>,
) -> Result<serde_json::Value, String> {
  let timeout = std::time::Duration::from_millis(timeout_ms.unwrap_or(10_000).max(500));
  let parsed = url::Url::parse(&url).map_err(|e| format!("栖息地地址无效：{e}"))?;
  if let Some(host) = parsed.host_str() {
    match tokio::net::lookup_host((host, parsed.port().unwrap_or(80))).await {
      Ok(mut addrs) => {
        if addrs.next().is_none() {
          return Err(format!(
            "无法解析主机名 `{host}`（无地址）。请检查本机 hosts / ZeroTier DNS，或改用 IP"
          ));
        }
      }
      Err(e) => {
        return Err(format!(
          "无法解析主机名 `{host}`：{e}。请在本机 hosts 写入该名，或确认 ZeroTier DNS 可用；也可暂用 IP"
        ));
      }
    }
  }
  let client = reqwest::Client::builder()
    .timeout(timeout)
    .redirect(reqwest::redirect::Policy::limited(5))
    .no_proxy()
    .build()
    .map_err(|e| e.to_string())?;
  let mut req = client.get(&url);
  if let Some(t) = token.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
    req = req.bearer_auth(t);
  }
  let res = req.send().await.map_err(|e| format!("网络错误：{e}"))?;
  let status = res.status();
  if !status.is_success() {
    return Err(format!("HTTP {}", status.as_u16()));
  }
  res
    .json::<serde_json::Value>()
    .await
    .map_err(|e| format!("栖息地 health 响应无效：{e}"))
}

fn dirs_next_home() -> std::path::PathBuf {
  std::env::var_os("HOME")
    .or_else(|| std::env::var_os("USERPROFILE"))
    .map(std::path::PathBuf::from)
    .unwrap_or_else(|| std::path::PathBuf::from("."))
}

#[cfg(desktop)]
fn build_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let show = MenuItem::with_id(app, "show", "打开主窗口", true, None::<&str>)?;
  let settings = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &settings, &quit])?;

  let _tray = TrayIconBuilder::new()
    .menu(&menu)
    .tooltip("FreeAnima")
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.show();
          let _ = w.set_focus();
        }
      }
      "settings" => {
        let _ = open_settings(app.clone());
      }
      "quit" => {
        app.exit(0);
      }
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.show();
          let _ = w.set_focus();
        }
      }
    })
    .build(app)?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_notification::init())
    .manage(ShellState::default());

  #[cfg(desktop)]
  {
    use tauri_plugin_autostart::MacosLauncher;
    builder = builder
      .plugin(tauri_plugin_autostart::init(
        MacosLauncher::LaunchAgent,
        Some(vec![]),
      ))
      .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.show();
          let _ = w.set_focus();
        }
      }))
      .plugin(tauri_plugin_shell::init())
      .invoke_handler(tauri::generate_handler![
        get_habitat_config,
        set_habitat_config,
        open_settings,
        set_pomodoro_widget_state,
        get_pomodoro_widget_state,
        set_click_through,
        set_pointer_active,
        move_companion_window,
        get_companion_position,
        get_patrol_screen,
        get_cursor_position,
        start_companion_drag,
        get_companion_visible,
        set_companion_visible,
        report_remote_tools_status,
        get_remote_tools_status,
        show_native_alert,
        instance_load,
        instance_save,
        probe_habitat_health,
      ])
      .setup(|app| {
        build_tray(app.handle())?;
        ensure_companion(app.handle()).ok();
        let handle = app.handle().clone();
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_millis(1200));
          let state = handle.state::<ShellState>();
          let visible = *state.companion_visible.lock().expect("cv");
          if visible {
            let _ = set_companion_visible(handle.clone(), state, true);
          }
        });
        Ok(())
      })
      .on_window_event(|window, event| {
        if window.label() == "main" {
          if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
          }
        }
      });
  }

  #[cfg(mobile)]
  {
    builder = builder
      .invoke_handler(tauri::generate_handler![
        get_habitat_config,
        set_habitat_config,
        open_settings,
        set_pomodoro_widget_state,
        get_pomodoro_widget_state,
        show_native_alert,
        instance_load,
        instance_save,
        probe_habitat_health,
      ])
      .setup(|app| {
        // 移动端 prefs 在 app_config_dir；启动时 Default 是空的，这里再读一次。
        if let Ok(path) = shell_prefs_path(app.handle()) {
          let prefs = load_shell_prefs_from(&path);
          let state = app.state::<ShellState>();
          apply_loaded_prefs_to_state(&state, &prefs);
        }
        Ok(())
      });
  }

  builder
    .run(tauri::generate_context!())
    .expect("error while running FreeAnima Tauri portal");
}
