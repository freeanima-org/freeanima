//! Windows Toast 需要已注册的 AppUserModelID；安装包路径下插件会把
//! `System.AppUserModel.ID` 设为 bundle identifier，未注册则 WinRT 静默丢弃通知。

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use tauri::{AppHandle, Runtime};

#[link(name = "shell32")]
extern "system" {
  fn SetCurrentProcessExplicitAppUserModelID(app_id: *const u16) -> i32;
}

fn to_wide_null(s: &str) -> Vec<u16> {
  OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

/// 注册当前进程 AUMID 并写入 HKCU（幂等；失败仅打日志）。
pub fn register_aumid<R: Runtime>(app: &AppHandle<R>) {
  let identifier = app.config().identifier.clone();
  if identifier.is_empty() {
    eprintln!("[aumid] empty identifier, skip");
    return;
  }
  let display = app
    .config()
    .product_name
    .clone()
    .unwrap_or_else(|| identifier.clone());

  let wide = to_wide_null(&identifier);
  let hr = unsafe { SetCurrentProcessExplicitAppUserModelID(wide.as_ptr()) };
  if hr != 0 {
    eprintln!("[aumid] SetCurrentProcessExplicitAppUserModelID failed: HRESULT={hr:#x}");
  }

  match write_aumid_registry(&identifier, &display) {
    Ok(()) => {}
    Err(e) => eprintln!("[aumid] registry write failed: {e}"),
  }
}

fn write_aumid_registry(aumid: &str, display_name: &str) -> Result<(), String> {
  use winreg::enums::HKEY_CURRENT_USER;
  use winreg::RegKey;

  let hkcu = RegKey::predef(HKEY_CURRENT_USER);
  let path = format!(r"Software\Classes\AppUserModelId\{aumid}");
  let (key, _) = hkcu
    .create_subkey(&path)
    .map_err(|e| format!("create_subkey: {e}"))?;
  key
    .set_value("DisplayName", &display_name)
    .map_err(|e| format!("DisplayName: {e}"))?;
  if let Ok(exe) = std::env::current_exe() {
    let _ = key.set_value("IconUri", &exe.to_string_lossy().to_string());
  }
  Ok(())
}
