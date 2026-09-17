//! Android 语音唤醒与 SpeechRecognizer — 注册 Kotlin VoiceWakePlugin。

use tauri::{
  plugin::{Builder as PluginBuilder, TauriPlugin},
  Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.freeanima.portal.voicewake";

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  PluginBuilder::new("voice-wake")
    .setup(|_app, api| {
      #[cfg(target_os = "android")]
      {
        let _handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "VoiceWakePlugin")?;
      }
      #[cfg(not(target_os = "android"))]
      {
        let _ = api;
      }
      Ok(())
    })
    .build()
}
