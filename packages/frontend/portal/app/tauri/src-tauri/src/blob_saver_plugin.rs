//! Android：将 blob 写入系统下载目录 — 注册 Kotlin BlobSaverPlugin。

use tauri::{
  plugin::{Builder as PluginBuilder, TauriPlugin},
  Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.freeanima.portal.blob";

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  PluginBuilder::new("blob-saver")
    .setup(|_app, api| {
      #[cfg(target_os = "android")]
      {
        let _handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "BlobSaverPlugin")?;
      }
      #[cfg(not(target_os = "android"))]
      {
        let _ = api;
      }
      Ok(())
    })
    .build()
}
