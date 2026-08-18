//! Coding Outpost：本机工作区 FS + 一次性命令 + 选目录。
#![cfg(desktop)]

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

/// Windows GUI 父进程下隐藏子进程控制台。勿与 DETACHED_PROCESS 叠用（要 wait 收 stdout）。
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFsSearchResult {
  pub result: String,
}

fn path_buf(path: &str) -> Result<PathBuf, String> {
  let p = PathBuf::from(path);
  if path.trim().is_empty() {
    return Err("path is empty".into());
  }
  Ok(p)
}

fn to_posix(p: &Path) -> String {
  p.to_string_lossy().replace('\\', "/")
}

fn hide_console(cmd: &mut Command) {
  cmd.stdin(std::process::Stdio::null());
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.as_std_mut().creation_flags(CREATE_NO_WINDOW);
  }
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

fn rel_under_root(workspace_root: &str, abs_posix: &str) -> Option<String> {
  let root = workspace_root.trim_end_matches('/');
  if abs_posix == root {
    return Some(".".into());
  }
  let prefix = format!("{root}/");
  abs_posix.strip_prefix(&prefix).map(str::to_string)
}

fn should_skip_rel(rel: &str) -> bool {
  rel.split('/').any(|p| p == "node_modules" || p == ".git")
}

fn search_files(
  start: &Path,
  workspace_root: &str,
  pattern: &str,
  max_files: usize,
  limit: usize,
  mode: &str,
) -> Result<String, String> {
  let mut files = Vec::new();
  walk_files_inner(start, start, max_files, &mut files)?;
  let root = to_posix(Path::new(workspace_root.trim_end_matches(['/', '\\'])));
  let mut hits: Vec<String> = Vec::new();
  let mut count = 0usize;

  for abs in files {
    let abs_posix = to_posix(Path::new(&abs));
    let Some(rel) = rel_under_root(&root, &abs_posix) else {
      continue;
    };
    if should_skip_rel(&rel) {
      continue;
    }
    let text = match std::fs::read_to_string(&abs) {
      Ok(t) => t,
      Err(_) => continue,
    };
    if !text.contains(pattern) {
      continue;
    }
    count += 1;
    if mode == "count" {
      continue;
    }
    if mode == "files_only" {
      if hits.len() < limit {
        hits.push(rel);
      }
      if hits.len() >= limit {
        break;
      }
      continue;
    }
    for (i, line) in text.split('\n').enumerate() {
      if !line.contains(pattern) {
        continue;
      }
      if hits.len() >= limit {
        break;
      }
      hits.push(format!("{}:{}:{}", rel, i + 1, line));
    }
    if hits.len() >= limit {
      break;
    }
  }

  if mode == "count" {
    return Ok(serde_json::json!({ "count": count }).to_string());
  }
  Ok(hits.join("\n"))
}

#[tauri::command]
pub fn workspace_fs_search(
  path: String,
  workspace_root: String,
  pattern: String,
  max_files: Option<usize>,
  limit: Option<usize>,
  output_mode: Option<String>,
) -> Result<WorkspaceFsSearchResult, String> {
  if pattern.is_empty() {
    return Err("pattern 不能为空".into());
  }
  let start = path_buf(&path)?;
  let root = workspace_root.trim();
  if root.is_empty() {
    return Err("workspace_root is empty".into());
  }
  let mode = output_mode.unwrap_or_else(|| "content".into());
  let result = search_files(
    &start,
    root,
    &pattern,
    max_files.unwrap_or(5000).max(1),
    limit.unwrap_or(50).max(1),
    &mode,
  )?;
  Ok(WorkspaceFsSearchResult { result })
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
pub async fn run_command(
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
  hide_console(&mut child);
  child.stdout(std::process::Stdio::piped());
  child.stderr(std::process::Stdio::piped());

  let mut spawned = child.spawn().map_err(|e| e.to_string())?;
  let mut stdout_pipe = spawned.stdout.take();
  let mut stderr_pipe = spawned.stderr.take();
  let stdout_task = tokio::spawn(async move {
    let mut s = String::new();
    if let Some(ref mut out) = stdout_pipe {
      let _ = out.read_to_string(&mut s).await;
    }
    s
  });
  let stderr_task = tokio::spawn(async move {
    let mut s = String::new();
    if let Some(ref mut err) = stderr_pipe {
      let _ = err.read_to_string(&mut s).await;
    }
    s
  });

  match tokio::time::timeout(timeout, spawned.wait()).await {
    Ok(Ok(status)) => {
      let stdout = stdout_task.await.ok().unwrap_or_default();
      let stderr = stderr_task.await.ok().unwrap_or_default();
      Ok(RunCommandResult {
        stdout,
        stderr,
        exit_code: status.code().unwrap_or(-1),
        timed_out: false,
      })
    }
    Ok(Err(e)) => {
      stdout_task.abort();
      stderr_task.abort();
      Err(e.to_string())
    }
    Err(_) => {
      let _ = spawned.start_kill();
      let _ = spawned.wait().await;
      stdout_task.abort();
      stderr_task.abort();
      Ok(RunCommandResult {
        stdout: String::new(),
        stderr: format!("timed out after {}ms", timeout.as_millis()),
        exit_code: -1,
        timed_out: true,
      })
    }
  }
}

#[cfg(test)]
mod tests {
  use super::{rel_under_root, search_files, split_command_line};
  use std::fs;
  use std::path::Path;

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

  #[test]
  fn rel_under_root_posix() {
    assert_eq!(
      rel_under_root("/tmp/ws", "/tmp/ws/README.md").as_deref(),
      Some("README.md")
    );
    assert_eq!(rel_under_root("/tmp/ws", "/tmp/ws").as_deref(), Some("."));
    assert_eq!(rel_under_root("/tmp/ws", "/tmp/other"), None);
  }

  #[test]
  fn search_files_content_and_files_only() {
    let dir = std::env::temp_dir().join(format!(
      "coding-fs-search-{}",
      std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos()
    ));
    fs::create_dir_all(dir.join("src")).unwrap();
    fs::write(dir.join("README.md"), "# demo\nhello world\n").unwrap();
    fs::write(dir.join("src/hello.ts"), "const x = 1;\n").unwrap();
    fs::create_dir_all(dir.join("node_modules/pkg")).unwrap();
    fs::write(dir.join("node_modules/pkg/skip.js"), "hello hidden\n").unwrap();
    let root = super::to_posix(&dir);

    let files_only = search_files(Path::new(&dir), &root, "hello", 5000, 50, "files_only").unwrap();
    assert!(files_only.contains("README.md"));
    assert!(!files_only.contains("node_modules"));

    let content = search_files(Path::new(&dir), &root, "hello", 5000, 50, "content").unwrap();
    assert!(content.contains("README.md:2:hello world"));

    let count = search_files(Path::new(&dir), &root, "hello", 5000, 50, "count").unwrap();
    assert!(count.contains("\"count\":"));
    let _ = fs::remove_dir_all(&dir);
  }

  #[cfg(windows)]
  #[test]
  fn create_no_window_flag() {
    assert_eq!(super::CREATE_NO_WINDOW, 0x08000000);
    let mut c = tokio::process::Command::new("cmd");
    super::hide_console(&mut c);
  }
}
