import { createBrowserSpeechAdapter } from "./browser-adapter.ts";
import { consumeLastHubSpeechError, createHabitatSpeechAdapter } from "./habitat-adapter.ts";
import type { SpeechPlaybackAdapter } from "./adapter-types.ts";
import type { SpeechPlaybackConfig } from "./types.ts";

function createSpeechAdapterDefault(config: SpeechPlaybackConfig): SpeechPlaybackAdapter {
  if (config.provider === "web-speech") {
    return createBrowserSpeechAdapter(undefined, config);
  }
  return createHabitatSpeechAdapter(config);
}

let createSpeechAdapterImpl: (config: SpeechPlaybackConfig) => SpeechPlaybackAdapter =
  createSpeechAdapterDefault;

export function createSpeechAdapter(config: SpeechPlaybackConfig): SpeechPlaybackAdapter {
  return createSpeechAdapterImpl(config);
}

/** 单测注入假 adapter；传 null 恢复默认。勿用 mock.module 替换本模块。 */
export function setCreateSpeechAdapterForTests(
  fn: ((config: SpeechPlaybackConfig) => SpeechPlaybackAdapter) | null,
): void {
  createSpeechAdapterImpl = fn ?? createSpeechAdapterDefault;
}

let previewAdapter: ReturnType<typeof createSpeechAdapter> | null = null;

export function stopSpeechPreview(config: SpeechPlaybackConfig): void {
  previewAdapter?.stop();
  previewAdapter = null;
  createSpeechAdapter(config).stop();
}

export async function previewSpeech(
  text: string,
  config: SpeechPlaybackConfig,
  locale: string,
): Promise<void> {
  const adapter = createSpeechAdapter(config);
  previewAdapter = adapter;
  if (!adapter.isSupported()) {
    throw new Error("当前环境不支持所选朗读方式");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("试听文本不能为空");
  }

  adapter.stop();

  return new Promise((resolve, reject) => {
    adapter.speak(
      trimmed,
      locale,
      () => resolve(),
      () => reject(new Error(consumeLastHubSpeechError() ?? "语音播放失败")),
    );
  });
}
