//! FreeAnima Portal — Tauri host（桌面：主窗 + companion + coding；移动：单 WebView + 小组件）。

#[cfg(all(desktop, target_os = "windows"))]
mod packaged_update;
#[cfg(all(desktop, target_os = "windows"))]
mod windows_aumid;
#[cfg(desktop)]
mod shell_icons;
#[cfg(desktop)]
mod coding_fs;
#[cfg(mobile)]
mod apk_installer_plugin;

use serde::{Deserialize, Serialize};
#[cfg(desktop)]
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(desktop)]
use tauri::{PhysicalPosition, WebviewUrl, WebviewWindowBuilder};
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[cfg(desktop)]
/// 角色 footprint（逻辑 px）；OS overlay 窗为工作区全屏，此值仅作巡逻边距 / 初始占位
const COMPANION_W: f64 = 160.0;
#[cfg(desktop)]
const COMPANION_H: f64 = 260.0;
#[cfg(desktop)]
const CODING_W: f64 = 1280.0;
#[cfg(desktop)]
const CODING_H: f64 = 800.0;
const DEFAULT_HABITAT: &str = "http://127.0.0.1:2658";
const SHELL_PREFS_FILE: &str = "desktop-shell.json";

#[cfg(desktop)]
static IS_QUITTING: AtomicBool = AtomicBool::new(false);
#[cfg(desktop)]
static TRAY_BLINK_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedShellPrefs {
  #[serde(default)]
  habitat_url: String,
  #[serde(default)]
  remote_auth_token: String,
  #[serde(default = "default_companion_visible")]
  companion_visible: bool,
  #[serde(default)]
  coding_visible: bool,
}

fn default_companion_visible() -> bool {
  true
}

fn default_anima_home_dirname() -> &'static str {
  option_env!("FREEANIMA_DEFAULT_HOME_DIRNAME").unwrap_or(".anima")
}

fn product_display_name() -> &'static str {
  option_env!("FREEANIMA_PRODUCT_NAME").unwrap_or("FreeAnima")
}

fn anima_home() -> std::path::PathBuf {
  if let Ok(h) = std::env::var("FREEANIMA_HOME") {
    return std::path::PathBuf::from(h);
  }
  let mut h = dirs_next_home();
  h.push(default_anima_home_dirname());
  h
}

/// 桌面：`~/.anima`（channel=local 时为 `~/.anima-dev`，可用 FREEANIMA_HOME 覆盖）；移动：应用私有 config 目录。
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
  // 无 AppHandle 时（进程启动）：桌面可读壳 home；移动端先默认，setup 再从 app_config_dir 覆盖。
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
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub struct CompanionModelStatus {
  pub model_loading: bool,
  pub error: Option<String>,
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

/// Android 本机提醒 channel：High（优先横幅）+ Public（锁屏可见）。
#[cfg(target_os = "android")]
const NATIVE_ALERT_CHANNEL_ID: &str = "freeanima.reminders";

fn map_native_alert_permission(
  state: tauri::plugin::PermissionState,
) -> &'static str {
  use tauri::plugin::PermissionState;
  match state {
    PermissionState::Granted => "granted",
    PermissionState::Denied => "denied",
    PermissionState::Prompt | PermissionState::PromptWithRationale => "default",
  }
}

#[cfg(target_os = "android")]
fn ensure_native_alert_channel(app: &AppHandle) -> Result<(), String> {
  use tauri_plugin_notification::{
    Channel, Importance, NotificationExt, Visibility,
  };
  let channel = Channel::builder(NATIVE_ALERT_CHANNEL_ID, "提醒")
    .description("本机瞬时提醒（番茄钟、收件箱、聊天等）")
    .importance(Importance::High)
    .visibility(Visibility::Public)
    .vibration(true)
    .build();
  app
    .notification()
    .create_channel(channel)
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn read_native_alert_permission(app: AppHandle) -> Result<String, String> {
  use tauri_plugin_notification::NotificationExt;
  let state = app
    .notification()
    .permission_state()
    .map_err(|e| e.to_string())?;
  Ok(map_native_alert_permission(state).to_string())
}

#[tauri::command]
fn request_native_alert_permission(app: AppHandle) -> Result<String, String> {
  use tauri_plugin_notification::NotificationExt;
  let state = app
    .notification()
    .request_permission()
    .map_err(|e| e.to_string())?;
  Ok(map_native_alert_permission(state).to_string())
}

struct ShellState {
  #[cfg(desktop)]
  companion_visible: Mutex<bool>,
  #[cfg(desktop)]
  coding_visible: Mutex<bool>,
  #[cfg(desktop)]
  clickthrough: Mutex<bool>,
  #[cfg(desktop)]
  pointer_active: Mutex<bool>,
  #[cfg(desktop)]
  remote_tools: Mutex<RemoteToolsStatus>,
  #[cfg(desktop)]
  companion_model: Mutex<CompanionModelStatus>,
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
      coding_visible: Mutex::new(prefs.coding_visible),
      #[cfg(desktop)]
      clickthrough: Mutex::new(false),
      #[cfg(desktop)]
      pointer_active: Mutex::new(false),
      #[cfg(desktop)]
      remote_tools: Mutex::new(RemoteToolsStatus::default()),
      #[cfg(desktop)]
      companion_model: Mutex::new(CompanionModelStatus::default()),
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
fn companion_url(_app: &AppHandle) -> WebviewUrl {
  if let Ok(overlay) = std::env::var("COMPANION_OVERLAY_URL") {
    if let Ok(parsed) = overlay.parse() {
      return WebviewUrl::External(parsed);
    }
  }
  // 打包：与主窗同 custom protocol（frontendDist `companion/`），IPC / ES module 可用。
  // 切勿用 file:// 加载 bundle resources — Windows WebView2 下常空窗（仅 DWM 虚线框）且 invoke 失败，
  // remote_tools.attach 也不会跑。Dev：`just dev tauri` 注入 COMPANION_OVERLAY_URL → :4176。
  WebviewUrl::App(std::path::PathBuf::from("companion/index.html"))
}

#[cfg(desktop)]
fn coding_url(_app: &AppHandle) -> WebviewUrl {
  if let Ok(url) = std::env::var("CODING_WINDOW_URL") {
    if let Ok(parsed) = url.parse() {
      return WebviewUrl::External(parsed);
    }
  }
  WebviewUrl::App(std::path::PathBuf::from("coding/index.html"))
}

#[cfg(desktop)]
fn ensure_coding(app: &AppHandle) -> Result<(), String> {
  if app.get_webview_window("coding").is_some() {
    return Ok(());
  }
  let url = coding_url(app);
  let mut builder = WebviewWindowBuilder::new(app, "coding", url)
    .title("编码工作台")
    .inner_size(CODING_W, CODING_H)
    .min_inner_size(800.0, 560.0)
    .resizable(true)
    .decorations(true)
    .visible(false);
  #[cfg(windows)]
  {
    builder = builder.additional_browser_args(webview_browser_args());
  }
  builder.build().map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg(desktop)]
fn webview_browser_args() -> &'static str {
  "--host-resolver-rules=MAP tauri.localhost 127.0.0.1,MAP ipc.localhost 127.0.0.1 --dns-over-https-mode=off"
}

#[cfg(desktop)]
fn fit_companion_to_work_area(app: &AppHandle) -> Result<(), String> {
  let win = app
    .get_webview_window("companion")
    .ok_or_else(|| "companion window not found".to_string())?;
  let monitor = win
    .current_monitor()
    .map_err(|e| e.to_string())?
    .or_else(|| app.primary_monitor().ok().flatten())
    .ok_or_else(|| "no monitor".to_string())?;
  let area = monitor.work_area();
  win
    .set_position(tauri::Position::Physical(area.position))
    .map_err(|e| e.to_string())?;
  win
    .set_size(tauri::Size::Physical(area.size))
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg(desktop)]
fn ensure_companion(app: &AppHandle) -> Result<(), String> {
  if app.get_webview_window("companion").is_some() {
    return fit_companion_to_work_area(app);
  }
  let url = companion_url(app);
  // 工作区全屏透明 overlay；SPA 内全屏 WebGL，角色以屏内 footprint 坐标放置
  let mut builder = WebviewWindowBuilder::new(app, "companion", url)
    .title("")
    .inner_size(COMPANION_W, COMPANION_H)
    .resizable(false)
    .decorations(false)
    // Windows：shadow(true) 会给无边框窗画 1px 白边/虚线外框；Electron 侧 hasShadow:false
    .shadow(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false);
  #[cfg(windows)]
  {
    builder = builder.additional_browser_args(webview_browser_args());
  }
  builder.build().map_err(|e| e.to_string())?;
  fit_companion_to_work_area(app)
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
  let companion_visible = *state.companion_visible.lock().expect("cv");
  #[cfg(desktop)]
  let coding_visible = *state.coding_visible.lock().expect("coding_vis");
  #[cfg(not(desktop))]
  let companion_visible = true;
  #[cfg(not(desktop))]
  let coding_visible = false;
  save_shell_prefs(
    &app,
    &PersistedShellPrefs {
      habitat_url: cfg.habitat_url,
      remote_auth_token: cfg.remote_auth_token,
      companion_visible,
      coding_visible,
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
  let scale = win.scale_factor().map_err(|e| e.to_string())?;
  let scale = if scale > 0.0 { scale } else { 1.0 };
  let size = win.inner_size().map_err(|e| e.to_string())?;
  // overlay 已铺满工作区：巡逻坐标系 = 窗内 CSS 像素；window_* = 角色 footprint
  Ok(PatrolScreenInfo {
    avail_left: 0,
    avail_top: 0,
    avail_width: (size.width as f64 / scale).round().max(0.0) as u32,
    avail_height: (size.height as f64 / scale).round().max(0.0) as u32,
    window_width: COMPANION_W.round().max(1.0) as u32,
    window_height: COMPANION_H.round().max(1.0) as u32,
  })
}

/// 返回相对 companion 窗的 CSS 像素坐标（与 `getBoundingClientRect` / hitTest 一致）。
/// 切勿直接回屏幕物理坐标——否则 hitTest 恒 false，窗体会一直 `ignore_cursor`。
#[cfg(desktop)]
#[tauri::command]
fn get_cursor_position(app: AppHandle) -> ScreenPoint {
  use mouse_position::mouse_position::Mouse;
  let Mouse::Position { x, y } = Mouse::get_mouse_position() else {
    return ScreenPoint { x: 0, y: 0 };
  };
  let Some(win) = app.get_webview_window("companion") else {
    return ScreenPoint { x, y };
  };
  let Ok(pos) = win.outer_position() else {
    return ScreenPoint { x: 0, y: 0 };
  };
  let scale = win.scale_factor().unwrap_or(1.0);
  if scale <= 0.0 {
    return ScreenPoint { x: 0, y: 0 };
  }
  // mouse_position / outer_position：物理像素；WebView hitTest：CSS 逻辑像素
  let local_x = ((x as f64) - (pos.x as f64)) / scale;
  let local_y = ((y as f64) - (pos.y as f64)) / scale;
  ScreenPoint {
    x: local_x.round() as i32,
    y: local_y.round() as i32,
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
  let coding_visible = *state.coding_visible.lock().expect("coding_vis");
  save_shell_prefs(
    &app,
    &PersistedShellPrefs {
      habitat_url: habitat.habitat_url,
      remote_auth_token: habitat.remote_auth_token,
      companion_visible: visible,
      coding_visible,
    },
  )?;
  if visible {
    ensure_companion(&app)?;
    if let Some(win) = app.get_webview_window("companion") {
      win.show().map_err(|e| e.to_string())?;
      // 重建或再次 show 时补发，避免漏收 config-changed
      let _ = app.emit("shell:config-changed", ());
    }
  } else {
    // 关显示 = 关闭 WebView = Outpost 离线（attach 随 SPA unmount 拆除）
    if let Some(win) = app.get_webview_window("companion") {
      let _ = win.hide();
      let _ = win.close();
    }
    *state.remote_tools.lock().expect("rt") = RemoteToolsStatus::default();
    *state.companion_model.lock().expect("cm") = CompanionModelStatus::default();
    let _ = app.emit(
      "shell:companion-model-status",
      serde_json::json!({ "loading": false, "error": null }),
    );
  }
  Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn get_coding_visible(state: State<'_, ShellState>) -> bool {
  *state.coding_visible.lock().expect("coding_vis")
}

#[cfg(desktop)]
#[tauri::command]
fn set_coding_visible(app: AppHandle, state: State<'_, ShellState>, visible: bool) -> Result<(), String> {
  *state.coding_visible.lock().expect("coding_vis") = visible;
  let habitat = state.habitat.lock().expect("habitat lock").clone();
  let companion_visible = *state.companion_visible.lock().expect("cv");
  save_shell_prefs(
    &app,
    &PersistedShellPrefs {
      habitat_url: habitat.habitat_url,
      remote_auth_token: habitat.remote_auth_token,
      companion_visible,
      coding_visible: visible,
    },
  )?;
  if visible {
    ensure_coding(&app)?;
    if let Some(win) = app.get_webview_window("coding") {
      win.show().map_err(|e| e.to_string())?;
      let _ = win.set_focus();
      let _ = app.emit("shell:config-changed", ());
    }
  } else {
    // Coding：hide 不 close，保持 SPA / attach 存活
    if let Some(win) = app.get_webview_window("coding") {
      let _ = win.hide();
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

#[cfg(desktop)]
#[tauri::command]
fn report_companion_model_status(state: State<'_, ShellState>, status: CompanionModelStatus) {
  *state.companion_model.lock().expect("cm") = status;
}

#[cfg(desktop)]
#[tauri::command]
fn get_companion_model_status(state: State<'_, ShellState>) -> CompanionModelStatus {
  state.companion_model.lock().expect("cm").clone()
}

#[tauri::command]
fn show_native_alert(app: AppHandle, payload: NativeAlertPayload) -> Result<(), String> {
  use tauri_plugin_notification::NotificationExt;
  #[cfg(target_os = "android")]
  ensure_native_alert_channel(&app)?;
  let mut n = app.notification().builder().title(payload.title);
  if let Some(body) = payload.body {
    n = n.body(body);
  }
  #[cfg(target_os = "android")]
  {
    n = n.channel_id(NATIVE_ALERT_CHANNEL_ID);
  }
  n.show().map_err(|e| e.to_string())?;
  let _ = payload.silent;
  Ok(())
}

/// 应用图标未读合计；桌面 Dock/任务栏。Android 无 launcher badge（follow-up）。
#[cfg(desktop)]
#[tauri::command]
fn set_app_badge_count(app: AppHandle, count: u32) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "main window missing".to_string())?;
  let n = i64::from(count);
  // macOS / Linux / iOS：数字角标；Windows 忽略此调用（走 overlay）
  let _ = window.set_badge_count(if count > 0 { Some(n) } else { None });
  #[cfg(target_os = "windows")]
  {
    if count > 0 {
      let _ = window.set_overlay_icon(Some(shell_icons::unread_badge_overlay()));
    } else {
      let _ = window.set_overlay_icon(None);
    }
  }
  if let Some(tray) = app.tray_by_id("main") {
    let tip = if count > 0 {
      format!("{} · {} 未读", product_display_name(), count)
    } else {
      product_display_name().to_string()
    };
    let _ = tray.set_tooltip(Some(&tip));
  }
  Ok(())
}

#[cfg(desktop)]
fn restore_tray_icon(app: &AppHandle) {
  if let Some(tray) = app.tray_by_id("main") {
    if let Some(icon) = app.default_window_icon().cloned() {
      let _ = tray.set_icon(Some(icon));
    }
  }
}

#[cfg(desktop)]
fn stop_tray_blink(app: &AppHandle) {
  TRAY_BLINK_ACTIVE.store(false, Ordering::SeqCst);
  restore_tray_icon(app);
}

#[cfg(desktop)]
fn start_tray_blink(app: &AppHandle) {
  if TRAY_BLINK_ACTIVE.swap(true, Ordering::SeqCst) {
    return;
  }
  let handle = app.clone();
  std::thread::spawn(move || {
    let mut phase = false;
    while TRAY_BLINK_ACTIVE.load(Ordering::SeqCst) {
      phase = !phase;
      let app = handle.clone();
      let show_attention = phase;
      let _ = app.clone().run_on_main_thread(move || {
        if !TRAY_BLINK_ACTIVE.load(Ordering::SeqCst) {
          return;
        }
        if let Some(tray) = app.tray_by_id("main") {
          if show_attention {
            let _ = tray.set_icon(Some(shell_icons::tray_attention_icon()));
          } else if let Some(icon) = app.default_window_icon().cloned() {
            let _ = tray.set_icon(Some(icon));
          }
        }
      });
      std::thread::sleep(std::time::Duration::from_millis(500));
    }
    let app = handle.clone();
    let _ = app.clone().run_on_main_thread(move || {
      restore_tray_icon(&app);
    });
  });
}

#[cfg(desktop)]
#[tauri::command]
fn request_app_attention(app: AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "main window missing".to_string())?;
  let focused = window.is_focused().unwrap_or(true);
  if focused {
    return Ok(());
  }
  let _ = window.request_user_attention(Some(tauri::UserAttentionType::Informational));
  start_tray_blink(&app);
  Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn clear_app_attention(app: AppHandle) -> Result<(), String> {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.request_user_attention(None);
  }
  stop_tray_blink(&app);
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
    Ok(
      anima_home()
        .join("satellites")
        .join(app_id)
        .join("instance.json"),
    )
  }
}

/// Desktop Windows：下载 NSIS 并静默安装。非 Windows 返回错误。
#[tauri::command]
#[cfg(desktop)]
fn apply_packaged_update(
  app: AppHandle,
  asset_url: String,
  expected_size: Option<u64>,
) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    packaged_update::apply_windows_packaged_update(&app, &asset_url, expected_size)
  }
  #[cfg(not(target_os = "windows"))]
  {
    let _ = (app, asset_url, expected_size);
    Err("当前桌面平台不支持覆盖安装（仅 Windows NSIS）".into())
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
  let res = req.send().await.map_err(|e| {
    let msg = e.to_string();
    // rustls 校验失败时常含 certificate / UnknownIssuer；提示与 OS 信任库对齐
    if msg.to_ascii_lowercase().contains("certificate")
      || msg.contains("UnknownIssuer")
      || msg.contains("invalid peer certificate")
    {
      format!(
        "网络错误（TLS 证书未被壳原生 HTTP 信任）：{msg}。请确认本机已安装栖息地 mkcert 根 CA，或暂用 http://…:2658"
      )
    } else {
      format!("网络错误：{msg}")
    }
  })?;
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
  let coding = MenuItem::with_id(app, "coding", "编码工作台", true, None::<&str>)?;
  let settings = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &coding, &settings, &quit])?;

  let icon = app
    .default_window_icon()
    .cloned()
    .ok_or("缺少默认窗口图标，无法创建托盘")?;
  let _tray = TrayIconBuilder::with_id("main")
    .icon(icon)
    .menu(&menu)
    .tooltip(product_display_name())
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.show();
          let _ = w.set_focus();
        }
      }
      "coding" => {
        let state = app.state::<ShellState>();
        let _ = set_coding_visible(app.clone(), state, true);
      }
      "settings" => {
        let _ = open_settings(app.clone());
      }
      "quit" => {
        IS_QUITTING.store(true, Ordering::SeqCst);
        for label in ["main", "companion", "coding"] {
          if let Some(w) = app.get_webview_window(label) {
            let _ = w.hide();
            let _ = w.close();
          }
        }
        app.cleanup_before_exit();
        std::process::exit(0);
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
        stop_tray_blink(app);
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
        get_coding_visible,
        set_coding_visible,
        report_remote_tools_status,
        get_remote_tools_status,
        report_companion_model_status,
        get_companion_model_status,
        show_native_alert,
        read_native_alert_permission,
        request_native_alert_permission,
        set_app_badge_count,
        request_app_attention,
        clear_app_attention,
        instance_load,
        instance_save,
        probe_habitat_health,
        apply_packaged_update,
        coding_fs::pick_directory,
        coding_fs::workspace_fs_list_dir,
        coding_fs::workspace_fs_read_text,
        coding_fs::workspace_fs_write_text,
        coding_fs::workspace_fs_exists,
        coding_fs::workspace_fs_is_dir,
        coding_fs::workspace_fs_walk_files,
        coding_fs::run_command,
      ])
      .setup(|app| {
        #[cfg(windows)]
        windows_aumid::register_aumid(app.handle());
        build_tray(app.handle())?;
        let handle = app.handle().clone();
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_millis(1200));
          let state = handle.state::<ShellState>();
          let visible = *state.companion_visible.lock().expect("cv");
          if visible {
            let _ = set_companion_visible(handle.clone(), state, true);
          }
          let state = handle.state::<ShellState>();
          let coding_visible = *state.coding_visible.lock().expect("coding_vis");
          if coding_visible {
            let _ = set_coding_visible(handle.clone(), state, true);
          }
        });
        Ok(())
      })
      .on_window_event(|window, event| {
        if window.label() == "main" || window.label() == "coding" {
          if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if !IS_QUITTING.load(Ordering::SeqCst) {
              api.prevent_close();
              let _ = window.hide();
              if window.label() == "coding" {
                let state = window.app_handle().state::<ShellState>();
                *state.coding_visible.lock().expect("coding_vis") = false;
              }
            }
          }
          if window.label() == "main" {
            if let tauri::WindowEvent::Focused(true) = event {
              let _ = window.request_user_attention(None);
              stop_tray_blink(window.app_handle());
            }
          }
        }
        // Windows：透明无边框窗失焦时 DWM 可能画出错误边框/标题条；1px 抖动强制重绘（迁自 Electron）
        #[cfg(windows)]
        if window.label() == "companion" {
          if let tauri::WindowEvent::Focused(false) = event {
            let _ = window.set_title("");
            if let Ok(size) = window.inner_size() {
              let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: size.width,
                height: size.height.saturating_add(1),
              }));
              let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: size.width,
                height: size.height,
              }));
            }
          }
        }
      });
  }

  #[cfg(mobile)]
  {
    builder = builder
      .plugin(apk_installer_plugin::init())
      .invoke_handler(tauri::generate_handler![
        get_habitat_config,
        set_habitat_config,
        open_settings,
        set_pomodoro_widget_state,
        get_pomodoro_widget_state,
        show_native_alert,
        read_native_alert_permission,
        request_native_alert_permission,
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
