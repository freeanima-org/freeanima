//! Coding SSH Remote：本机 OpenSSH 子进程（编排用，非工具中继）。
#![cfg(desktop)]

use serde::Serialize;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::process::Command;

/// Windows GUI 父进程下隐藏子进程控制台。
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshRunResult {
  pub stdout: String,
  pub stderr: String,
  pub exit_code: i32,
}

fn hide_console(cmd: &mut Command) {
  cmd.stdin(Stdio::null());
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.as_std_mut().creation_flags(CREATE_NO_WINDOW);
  }
}

fn detached_map() -> &'static Mutex<HashMap<String, u32>> {
  static MAP: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
  MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

fn new_handle_id() -> String {
  let ms = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  format!("ssh-tun-{ms}")
}

#[tauri::command]
pub async fn ssh_remote_run(
  command: String,
  args: Vec<String>,
  timeout_ms: Option<u64>,
) -> Result<SshRunResult, String> {
  let mut cmd = Command::new(&command);
  cmd.args(&args);
  hide_console(&mut cmd);
  cmd.stdout(Stdio::piped());
  cmd.stderr(Stdio::piped());

  let child = cmd.spawn().map_err(|e| format!("spawn {command}: {e}"))?;
  let timeout = Duration::from_millis(timeout_ms.unwrap_or(60_000));
  match tokio::time::timeout(timeout, child.wait_with_output()).await {
    Ok(Ok(out)) => Ok(SshRunResult {
      stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
      stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
      exit_code: out.status.code().unwrap_or(1),
    }),
    Ok(Err(e)) => Err(format!("wait: {e}")),
    Err(_) => Ok(SshRunResult {
      stdout: String::new(),
      stderr: "timed out".into(),
      exit_code: 124,
    }),
  }
}

#[tauri::command]
pub async fn ssh_remote_spawn_detached(command: String, args: Vec<String>) -> Result<String, String> {
  let mut cmd = Command::new(&command);
  cmd.args(&args);
  hide_console(&mut cmd);
  cmd.stdout(Stdio::null());
  cmd.stderr(Stdio::null());

  let child = cmd.spawn().map_err(|e| format!("spawn {command}: {e}"))?;
  let pid = child.id().ok_or_else(|| "no pid".to_string())?;
  let handle_id = new_handle_id();
  {
    let mut map = detached_map().lock().map_err(|_| "lock")?;
    map.insert(handle_id.clone(), pid);
  }
  tokio::spawn(async move {
    let _ = child.wait_with_output().await;
  });
  Ok(handle_id)
}

#[tauri::command]
pub async fn ssh_remote_stop_detached(handle_id: String) -> Result<(), String> {
  let pid = {
    let mut map = detached_map().lock().map_err(|_| "lock")?;
    map.remove(&handle_id)
  };
  if let Some(pid) = pid {
    #[cfg(unix)]
    {
      let _ = Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status()
        .await;
    }
    #[cfg(windows)]
    {
      let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .status()
        .await;
    }
  }
  Ok(())
}
