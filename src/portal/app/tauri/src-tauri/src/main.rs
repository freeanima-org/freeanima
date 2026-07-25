// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // NSIS 覆盖安装：优雅退出，避免安装器删旧版时进程仍占用文件。
  if std::env::args().any(|a| a == "--quit-for-install") {
    std::process::exit(0);
  }
  freeanima_portal_lib::run();
}
