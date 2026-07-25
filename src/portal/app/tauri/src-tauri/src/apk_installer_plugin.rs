//! Android APK 覆盖安装 — 注册 Kotlin ApkInstallerPlugin。

use tauri::{
  plugin::{Builder as PluginBuilder, TauriPlugin},
  Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.freeanima.portal.apk";

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  PluginBuilder::new("apk-installer")
    .setup(|_app, api| {
      #[cfg(target_os = "android")]
      {
        let _handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "ApkInstallerPlugin")?;
      }
      #[cfg(not(target_os = "android"))]
      {
        let _ = api;
      }
      Ok(())
    })
    .build()
}
