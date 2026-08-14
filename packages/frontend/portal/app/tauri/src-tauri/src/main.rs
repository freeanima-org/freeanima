// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // --quit-for-install 由 lib::run 内 single-instance / setup 处理：
  // 必须进入 run()，第二实例才能把参数转发给已运行主进程。
  freeanima_portal_lib::run();
}
