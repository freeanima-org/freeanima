//! Windows NSIS 覆盖安装（移植自 Electron packaged-update）。

use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};

const PE_MAGIC: [u8; 2] = [0x4d, 0x5a]; // MZ
const PROGRESS_EVENT: &str = "shell:packaged-update-progress";
const INSTALLER_NAME: &str = "freeanima-desktop-windows-x64-setup.exe";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackagedUpdateProgress {
  pub received: u64,
  pub total: Option<u64>,
  pub phase: &'static str,
}

fn emit_progress<R: Runtime>(app: &AppHandle<R>, progress: PackagedUpdateProgress) {
  let _ = app.emit(PROGRESS_EVENT, progress);
}

pub fn create_installer_temp_path(temp_root: &Path) -> Result<PathBuf, String> {
  let dir = tempfile_dir(temp_root)?;
  Ok(dir.join(INSTALLER_NAME))
}

fn tempfile_dir(temp_root: &Path) -> Result<PathBuf, String> {
  let stamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let dir = temp_root.join(format!("freeanima-desktop-update-{stamp}"));
  fs::create_dir_all(&dir).map_err(|e| format!("创建临时目录失败: {e}"))?;
  Ok(dir)
}

pub fn verify_downloaded_installer(path: &Path, expected_size: Option<u64>) -> Result<(), String> {
  let meta = fs::metadata(path).map_err(|e| format!("读取安装包失败: {e}"))?;
  if let Some(want) = expected_size {
    if meta.len() != want {
      return Err(format!(
        "安装包大小不符: 期望 {want} 字节, 实际 {} 字节",
        meta.len()
      ));
    }
  }
  let mut file = File::open(path).map_err(|e| format!("打开安装包失败: {e}"))?;
  let mut head = [0u8; 2];
  file
    .read_exact(&mut head)
    .map_err(|e| format!("读取安装包头失败: {e}"))?;
  if head != PE_MAGIC {
    return Err("安装包不是有效的 Windows 可执行文件".into());
  }
  Ok(())
}

fn download_installer_to_file<R: Runtime>(
  app: &AppHandle<R>,
  url: &str,
  dest: &Path,
  expected_size: Option<u64>,
) -> Result<(), String> {
  let client = reqwest::blocking::Client::builder()
    .user_agent("freeanima-desktop-updater")
    .redirect(reqwest::redirect::Policy::limited(10))
    .connect_timeout(Duration::from_secs(30))
    // 大安装包 + 慢网；超时后失败回传 UI，避免 Toast 永久「下载中」。
    .timeout(Duration::from_secs(600))
    .build()
    .map_err(|e| format!("创建下载客户端失败: {e}"))?;

  let mut res = client
    .get(url)
    .header(reqwest::header::ACCEPT, "application/octet-stream")
    .send()
    .map_err(|e| format!("下载安装包失败: {e}"))?;

  if !res.status().is_success() {
    return Err(format!("下载安装包失败 HTTP {}", res.status()));
  }

  let content_len = res.content_length();
  let total = expected_size.or(content_len);

  if let Some(parent) = dest.parent() {
    fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
  }
  let mut file = File::create(dest).map_err(|e| format!("写入安装包失败: {e}"))?;
  let mut buf = [0u8; 64 * 1024];
  let mut received: u64 = 0;
  let mut last_emit = Instant::now() - Duration::from_secs(1);

  loop {
    let n = res
      .read(&mut buf)
      .map_err(|e| format!("下载安装包失败: {e}"))?;
    if n == 0 {
      break;
    }
    file
      .write_all(&buf[..n])
      .map_err(|e| format!("写入安装包失败: {e}"))?;
    received += n as u64;
    if last_emit.elapsed() >= Duration::from_millis(100) || total == Some(received) {
      last_emit = Instant::now();
      emit_progress(
        app,
        PackagedUpdateProgress {
          received,
          total,
          phase: "downloading",
        },
      );
    }
  }
  file.flush().map_err(|e| format!("刷新安装包失败: {e}"))?;
  emit_progress(
    app,
    PackagedUpdateProgress {
      received,
      total: total.or(Some(received)),
      phase: "downloading",
    },
  );
  Ok(())
}

fn launch_windows_nsis_installer(installer_path: &Path) -> Result<u32, String> {
  let path_str = installer_path
    .to_str()
    .ok_or_else(|| "安装包路径无效".to_string())?;

  // NSIS setup 是 GUI 子系统：直接脱离进程树，勿经 cmd.exe（会弹控制台）。
  // CREATE_NO_WINDOW 与 DETACHED_PROCESS 互斥，此处不要叠前者。
  use std::os::windows::process::CommandExt;
  const DETACHED_PROCESS: u32 = 0x00000008;
  const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

  let child = Command::new(path_str)
    .arg("/S")
    .stdin(std::process::Stdio::null())
    .stdout(std::process::Stdio::null())
    .stderr(std::process::Stdio::null())
    .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
    .spawn()
    .map_err(|e| format!("无法启动安装程序: {e}"))?;
  Ok(child.id())
}

/// 下载并静默启动 NSIS；不在此退出应用（由 installer hooks / --quit-for-install 关闭）。
pub fn apply_windows_packaged_update<R: Runtime>(
  app: &AppHandle<R>,
  asset_url: &str,
  expected_size: Option<u64>,
) -> Result<(), String> {
  if !asset_url.starts_with("https://") {
    return Err("无效的安装包 URL".into());
  }

  let temp_root = std::env::temp_dir();
  let dest = create_installer_temp_path(&temp_root)?;
  download_installer_to_file(app, asset_url, &dest, expected_size)?;
  verify_downloaded_installer(&dest, expected_size)?;

  emit_progress(
    app,
    PackagedUpdateProgress {
      received: expected_size.unwrap_or(0),
      total: expected_size,
      phase: "installing",
    },
  );

  let pid = launch_windows_nsis_installer(&dest)?;
  eprintln!("[packaged-update] installer launched pid={pid} path={}", dest.display());
  Ok(())
}
