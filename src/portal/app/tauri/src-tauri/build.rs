fn main() {
  let channel = std::env::var("FREEANIMA_BUILD_CHANNEL").unwrap_or_else(|_| "dev".into());
  let channel = channel.trim().to_ascii_lowercase();
  let (home_dirname, product_name) = if channel == "dev" {
    (".anima-dev", "FreeAnima Dev")
  } else {
    (".anima", "FreeAnima")
  };
  println!("cargo:rustc-env=FREEANIMA_DEFAULT_HOME_DIRNAME={home_dirname}");
  println!("cargo:rustc-env=FREEANIMA_PRODUCT_NAME={product_name}");
  println!("cargo:rerun-if-env-changed=FREEANIMA_BUILD_CHANNEL");

  // 显式登记 app 命令 → 生成 allow-* ACL，供 capabilities（含 remote.urls Vite）引用。
  // 默认「本地全开」对 http://127.0.0.1:4186 等远程页无效，会报 not allowed / Plugin not found。
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
      "get_habitat_config",
      "set_habitat_config",
      "open_settings",
      "set_pomodoro_widget_state",
      "get_pomodoro_widget_state",
      "set_click_through",
      "set_pointer_active",
      "move_companion_window",
      "get_companion_position",
      "get_patrol_screen",
      "get_cursor_position",
      "start_companion_drag",
      "get_companion_visible",
      "set_companion_visible",
      "get_coding_visible",
      "set_coding_visible",
      "report_remote_tools_status",
      "get_remote_tools_status",
      "report_companion_model_status",
      "get_companion_model_status",
      "show_native_alert",
      "read_native_alert_permission",
      "request_native_alert_permission",
      "set_app_badge_count",
      "request_app_attention",
      "clear_app_attention",
      "instance_load",
      "instance_save",
      "probe_habitat_health",
      "apply_packaged_update",
      "pick_directory",
      "workspace_fs_list_dir",
      "workspace_fs_read_text",
      "workspace_fs_write_text",
      "workspace_fs_exists",
      "workspace_fs_is_dir",
      "workspace_fs_walk_files",
      "run_command",
    ])),
  )
  .expect("failed to run tauri-build");
}
