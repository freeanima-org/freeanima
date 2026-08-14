//! Coding Outpost：本机工作区 FS + 一次性命令 + 选目录。
#![cfg(desktop)]

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFsDirEntry {
  pub name: String,
  pub path: String,
  pub kind: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCommandResult {
  pub stdout: String,
  pub stderr: String,
  pub exit_code: i32,
  pub timed_out: bool,
}

fn path_buf(path: &str) -> Result<PathBuf, String> {
  let p = PathBuf::from(path);
  if path.trim().is_empty() {
    return Err("path is empty".into());
  }
  Ok(p)
}

#[tauri::command]
pub fn pick_directory() -> Result<Option<String>, String> {
  let picked = rfd::FileDialog::new().pick_folder();
  Ok(picked.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn workspace_fs_list_dir(path: String) -> Result<Vec<WorkspaceFsDirEntry>, String> {
  let dir = path_buf(&path)?;
  let meta = std::fs::metadata(&dir).map_err(|e| e.to_string())?;
  if !meta.is_dir() {
    return Err("not a directory".into());
  }
  let mut out = Vec::new();
  for ent in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let ent = ent.map_err(|e| e.to_string())?;
    let name = ent.file_name().to_string_lossy().into_owned();
    let p = ent.path();
    let file_type = ent.file_type().map_err(|e| e.to_string())?;
    let kind = if file_type.is_dir() {
      "dir"
    } else if file_type.is_file() {
      "file"
    } else {
      "other"
    };
    let size = if file_type.is_file() {
      ent.metadata().ok().map(|m| m.len())
    } else {
      None
    };
    out.push(WorkspaceFsDirEntry {
      name,
      path: p.to_string_lossy().into_owned(),
      kind: kind.into(),
      size,
    });
  }
  out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(out)
}

#[tauri::command]
pub fn workspace_fs_read_text(path: String) -> Result<String, String> {
  let p = path_buf(&path)?;
  std::fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn workspace_fs_write_text(path: String, content: String) -> Result<(), String> {
  let p = path_buf(&path)?;
  if let Some(parent) = p.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  std::fs::write(&p, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn workspace_fs_exists(path: String) -> Result<bool, String> {
  Ok(Path::new(&path).exists())
}

#[tauri::command]
pub fn workspace_fs_is_dir(path: String) -> Result<bool, String> {
  Ok(Path::new(&path).is_dir())
}

#[tauri::command]
pub fn workspace_fs_walk_files(path: String, max_files: Option<usize>) -> Result<Vec<String>, String> {
  let root = path_buf(&path)?;
  let limit = max_files.unwrap_or(5000).max(1);
  let mut out = Vec::new();
  walk_files_inner(&root, &root, limit, &mut out)?;
  Ok(out)
}

fn walk_files_inner(root: &Path, dir: &Path, limit: usize, out: &mut Vec<String>) -> Result<(), String> {
  if out.len() >= limit {
    return Ok(());
  }
  let rd = match std::fs::read_dir(dir) {
    Ok(rd) => rd,
    Err(_) => return Ok(()),
  };
  for ent in rd {
    if out.len() >= limit {
      break;
    }
    let ent = match ent {
      Ok(e) => e,
      Err(_) => continue,
    };
    let name = ent.file_name();
    let name_str = name.to_string_lossy();
    if name_str == "node_modules" || name_str == ".git" {
      continue;
    }
    let p = ent.path();
    let ft = match ent.file_type() {
      Ok(t) => t,
      Err(_) => continue,
    };
    if ft.is_dir() {
      walk_files_inner(root, &p, limit, out)?;
    } else if ft.is_file() {
      out.push(p.to_string_lossy().into_owned());
    }
  }
  Ok(())
}

/// Quote-aware argv split（与 Habitat `splitCommandLine` 同语义；无 shell 展开）。
fn split_command_line(command: &str) -> Vec<String> {
  let mut out: Vec<String> = Vec::new();
  let mut cur = String::new();
  let mut quote: Option<char> = None;
  let mut escape = false;

  for ch in command.chars() {
    if escape {
      cur.push(ch);
      escape = false;
      continue;
    }
    if quote.is_none() && ch == '\\' {
      escape = true;
      continue;
    }
    if let Some(q) = quote {
      if ch == q {
        quote = None;
      } else {
        cur.push(ch);
      }
      continue;
    }
    if ch == '\'' || ch == '"' {
      quote = Some(ch);
      continue;
    }
    if ch.is_whitespace() {
      if !cur.is_empty() {
        out.push(std::mem::take(&mut cur));
      }
      continue;
    }
    cur.push(ch);
  }
  if !cur.is_empty() {
    out.push(cur);
  }
  out
}

#[tauri::command]
pub fn run_command(
  command: String,
  cwd: Option<String>,
  timeout_ms: Option<u64>,
  shell: Option<bool>,
) -> Result<RunCommandResult, String> {
  let cmd = command.trim();
  if cmd.is_empty() {
    return Err("command is empty".into());
  }
  let use_shell = shell.unwrap_or(false);
  let timeout = Duration::from_millis(timeout_ms.unwrap_or(60_000).max(1));

  let mut child = if use_shell {
    #[cfg(windows)]
    {
      let mut c = Command::new("cmd");
      c.arg("/C").arg(cmd);
      c
    }
    #[cfg(not(windows))]
    {
      let mut c = Command::new("sh");
      c.arg("-c").arg(cmd);
      c
    }
  } else {
    let parts = split_command_line(cmd);
    let bin = parts.first().ok_or_else(|| "command is empty".to_string())?;
    let mut c = Command::new(bin);
    c.args(&parts[1..]);
    c
  };

  if let Some(dir) = cwd.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
    child.current_dir(dir);
  }
  child.stdout(std::process::Stdio::piped());
  child.stderr(std::process::Stdio::piped());

  let mut spawned = child.spawn().map_err(|e| e.to_string())?;
  let started = Instant::now();
  loop {
    match spawned.try_wait() {
      Ok(Some(status)) => {
        let stdout = {
          let mut s = String::new();
          if let Some(mut out) = spawned.stdout.take() {
            use std::io::Read;
            let _ = out.read_to_string(&mut s);
          }
          s
        };
        let stderr = {
          let mut s = String::new();
          if let Some(mut err) = spawned.stderr.take() {
            use std::io::Read;
            let _ = err.read_to_string(&mut s);
          }
          s
        };
        return Ok(RunCommandResult {
          stdout,
          stderr,
          exit_code: status.code().unwrap_or(-1),
          timed_out: false,
        });
      }
      Ok(None) => {
        if started.elapsed() > timeout {
          let _ = spawned.kill();
          let _ = spawned.wait();
          return Ok(RunCommandResult {
            stdout: String::new(),
            stderr: format!("timed out after {}ms", timeout.as_millis()),
            exit_code: -1,
            timed_out: true,
          });
        }
        std::thread::sleep(Duration::from_millis(20));
      }
      Err(e) => return Err(e.to_string()),
    }
  }
}

#[cfg(test)]
mod tests {
  use super::split_command_line;

  #[test]
  fn split_respects_double_and_single_quotes() {
    assert_eq!(
      split_command_line(r#"echo "a b" 'c d'"#),
      vec!["echo", "a b", "c d"]
    );
  }

  #[test]
  fn split_preserves_cjk_spaces_in_commit_message() {
    assert_eq!(
      split_command_line(r#"git commit -m "feat: 中文 带空格""#),
      vec!["git", "commit", "-m", "feat: 中文 带空格"]
    );
  }

  #[test]
  fn split_unquoted_whitespace() {
    assert_eq!(
      split_command_line("git status -sb"),
      vec!["git", "status", "-sb"]
    );
  }

  #[test]
  fn split_backslash_escape_outside_quotes() {
    assert_eq!(
      split_command_line(r#"echo a\ b"#),
      vec!["echo", "a b"]
    );
  }
}
