/// <reference lib="dom" />
import type { SpeechPlaybackAdapter, SpeechUnsupportedReason } from "./adapter-types.ts";
import { createSpeechAdapter } from "./create-adapter.ts";
import { createSpeechPlaybackController, type SpeechPlaybackController } from "./controller.ts";
import { consumeLastHubSpeechError } from "./habitat-adapter.ts";
import {
  getSharedMpegAudioElement,
  primeMpegSpeechOutput,
  resumeMpegPlaybackIfPaused,
} from "./mpeg-player.ts";
import { clearSpeechMediaSession, syncSpeechMediaSession } from "./speech-media-session.ts";
import {
  DEFAULT_SPEECH_PLAYBACK_CONFIG,
  parseSpeechConfigFromHub,
  type SpeechPlaybackConfig,
} from "./types.ts";
import { getWebSpeechUnsupportedReason } from "./web-speech-support.ts";

export type SpeechPlaybackSnapshot = {
  activeKey: string | null;
  config: SpeechPlaybackConfig;
  unsupportedReason: SpeechUnsupportedReason | null;
  playbackError: string | null;
  isSupported: boolean;
};

type Listener = () => void;

const SERVICE_STATE_KEY = "freeanimaSpeechPlaybackService";

type ServiceState = {
  config: SpeechPlaybackConfig;
  controller: SpeechPlaybackController;
  listeners: Set<Listener>;
  playbackError: string | null;
  playbackErrorTimer: ReturnType<typeof setTimeout> | null;
  configLoading: Promise<void> | null;
};

/** 会话内稳定朗读 key（相对 display 下标；切会话会 stop，故不跨会话复用） */
export function speechMessageKey(conversationId: string, displayIndex: number): string {
  return `${conversationId}:${displayIndex}`;
}

/** 流式自动朗读专用 key（与消息下标区分；点停只停播报，不关顶栏开关） */
export function speechStreamKey(conversationId: string): string {
  return `${conversationId}:stream`;
}

function wrapAdapterWithErrorHandler(
  adapter: SpeechPlaybackAdapter,
  onPlaybackError: () => void,
): SpeechPlaybackAdapter {
  return {
    isSupported: () => adapter.isSupported(),
    stop: () => adapter.stop(),
    speak(text, locale, onEnd, onError) {
      adapter.speak(text, locale, onEnd, () => {
        onPlaybackError();
        onError?.();
      });
    },
  };
}

function unsupportedReasonFor(config: SpeechPlaybackConfig): SpeechUnsupportedReason | null {
  if (!config.enabled) return "disabled";
  if (config.provider === "edge-tts") return null;
  return getWebSpeechUnsupportedReason(true);
}

function serviceRoot(): typeof globalThis & Record<string, ServiceState | undefined> {
  return globalThis as typeof globalThis & Record<string, ServiceState | undefined>;
}

function notify(state: ServiceState): void {
  for (const listener of state.listeners) listener();
  syncSpeechMediaSession(state.controller.getActiveKey());
}

function showPlaybackError(state: ServiceState): void {
  const detail = consumeLastHubSpeechError();
  state.playbackError = detail ?? "语音播放失败";
  if (state.playbackErrorTimer != null) clearTimeout(state.playbackErrorTimer);
  state.playbackErrorTimer = setTimeout(() => {
    state.playbackError = null;
    state.playbackErrorTimer = null;
    notify(state);
  }, 4000);
  notify(state);
}

function rebuildController(state: ServiceState): void {
  if (state.controller.getActiveKey()) state.controller.stop();
  const base = createSpeechAdapter(state.config);
  const adapter = wrapAdapterWithErrorHandler(base, () => showPlaybackError(state));
  state.controller = createSpeechPlaybackController(adapter, () => notify(state));
}

function createInitialState(): ServiceState {
  const config = DEFAULT_SPEECH_PLAYBACK_CONFIG;
  const listeners = new Set<Listener>();
  const state = {
    config,
    listeners,
    playbackError: null as string | null,
    playbackErrorTimer: null as ReturnType<typeof setTimeout> | null,
    configLoading: null as Promise<void> | null,
  } as ServiceState;
  const adapter = wrapAdapterWithErrorHandler(createSpeechAdapter(config), () =>
    showPlaybackError(state),
  );
  state.controller = createSpeechPlaybackController(adapter, () => notify(state));
  return state;
}

function getState(): ServiceState {
  const root = serviceRoot();
  if (!root[SERVICE_STATE_KEY]) {
    root[SERVICE_STATE_KEY] = createInitialState();
  }
  return root[SERVICE_STATE_KEY];
}

export function subscribeSpeechPlayback(listener: Listener): () => void {
  const state = getState();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

export function getSpeechPlaybackSnapshot(): SpeechPlaybackSnapshot {
  const state = getState();
  return {
    activeKey: state.controller.getActiveKey(),
    config: state.config,
    unsupportedReason: unsupportedReasonFor(state.config),
    playbackError: state.playbackError,
    isSupported: state.controller.isSupported(),
  };
}

export async function ensureSpeechPlaybackConfig(): Promise<void> {
  const state = getState();
  if (state.configLoading) return state.configLoading;
  state.configLoading = (async () => {
    try {
      const { fetchHabitatConfig } = await import("../habitat-config-api.ts");
      const data = await fetchHabitatConfig();
      const next = parseSpeechConfigFromHub(data.tts);
      const prev = state.config;
      const changed =
        prev.enabled !== next.enabled ||
        prev.provider !== next.provider ||
        prev.lang !== next.lang ||
        prev.voiceName !== next.voiceName ||
        prev.preferLocal !== next.preferLocal ||
        prev.rate !== next.rate ||
        prev.pitch !== next.pitch ||
        prev.volume !== next.volume;
      state.config = next;
      if (changed) rebuildController(state);
      else notify(state);
    } catch {
      /* 离线或 Habitat 未配置时沿用默认 */
    } finally {
      state.configLoading = null;
    }
  })();
  return state.configLoading;
}

export function toggleSpeechPlayback(key: string, text: string, locale: string): void {
  const state = getState();
  state.playbackError = null;
  state.controller.toggle(key, text, locale);
}

export function enqueueSpeechPlayback(key: string, text: string, locale: string): void {
  const state = getState();
  state.playbackError = null;
  state.controller.enqueue(key, text, locale);
}

export function stopSpeechPlayback(): void {
  getState().controller.stop();
  clearSpeechMediaSession();
}

export function isSpeechSpeaking(key: string): boolean {
  return getState().controller.isSpeaking(key);
}

export function primeSpeechPlaybackOutput(): void {
  primeMpegSpeechOutput();
}

/** 回前台：若仍在朗读但 HTMLAudio 被系统暂停，尝试恢复 */
export function resumeSpeechPlaybackIfNeeded(): void {
  const state = getState();
  if (!state.controller.getActiveKey()) return;
  if (state.config.provider !== "edge-tts") return;
  resumeMpegPlaybackIfPaused();
  syncSpeechMediaSession(state.controller.getActiveKey());
}

export function pauseSpeechPlaybackAudio(): void {
  const audio = getSharedMpegAudioElement();
  if (!audio || audio.paused) return;
  audio.pause();
  syncSpeechMediaSession(getState().controller.getActiveKey());
}

export function resetSpeechPlaybackServiceForTests(): void {
  const root = serviceRoot();
  const existing = root[SERVICE_STATE_KEY];
  if (existing?.playbackErrorTimer != null) clearTimeout(existing.playbackErrorTimer);
  existing?.controller.stop();
  clearSpeechMediaSession();
  delete root[SERVICE_STATE_KEY];
}
