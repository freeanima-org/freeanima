import { addPluginListener, invoke, type PluginListener } from "@tauri-apps/api/core";

import { getShellBuildTarget } from "../shell-runtime.ts";

export type VoiceWakePermissionState = "granted" | "denied";

export type VoiceWakeStartOptions = {
  wakePhrase?: string;
  sensitivity?: number;
};

export type VoiceWakeDetectedEvent = {
  phrase: string;
};

export type SpeechRecognitionResultEvent =
  | { ok: true; text: string; confidence?: number }
  | { ok: false; error: string };

export function isVoiceWakeSupported(): boolean {
  return getShellBuildTarget() === "mobile";
}

export async function readVoiceWakePermission(): Promise<VoiceWakePermissionState> {
  if (!isVoiceWakeSupported()) return "denied";
  const res = await invoke<{ state?: string }>("plugin:voice-wake|readVoiceWakePermission");
  return res.state === "granted" ? "granted" : "denied";
}

export async function requestVoiceWakePermission(): Promise<VoiceWakePermissionState> {
  if (!isVoiceWakeSupported()) return "denied";
  const res = await invoke<{ state?: string }>("plugin:voice-wake|requestVoiceWakePermission");
  return res.state === "granted" ? "granted" : "denied";
}

export async function startVoiceWake(opts?: VoiceWakeStartOptions): Promise<void> {
  if (!isVoiceWakeSupported()) {
    throw new Error("当前壳不支持语音唤醒");
  }
  await invoke("plugin:voice-wake|startVoiceWake", {
    wakePhrase: opts?.wakePhrase ?? "小风",
    sensitivity: opts?.sensitivity,
  });
}

export async function stopVoiceWake(): Promise<void> {
  if (!isVoiceWakeSupported()) return;
  await invoke("plugin:voice-wake|stopVoiceWake");
}

export async function listenVoiceWakeDetected(
  handler: (event: VoiceWakeDetectedEvent) => void,
): Promise<PluginListener> {
  return addPluginListener("voice-wake", "voiceWakeDetected", (raw: unknown) => {
    const event = (raw ?? {}) as { phrase?: string };
    const phrase = typeof event.phrase === "string" ? event.phrase : "";
    if (!phrase.trim()) return;
    handler({ phrase: phrase.trim() });
  });
}

export async function startNativeSpeechRecognition(): Promise<void> {
  if (!isVoiceWakeSupported()) {
    throw new Error("当前壳不支持原生语音识别");
  }
  await invoke("plugin:voice-wake|startSpeechRecognition");
}

export async function stopNativeSpeechRecognition(): Promise<void> {
  if (!isVoiceWakeSupported()) return;
  await invoke("plugin:voice-wake|stopSpeechRecognition");
}

export async function listenSpeechRecognitionResult(
  handler: (event: SpeechRecognitionResultEvent) => void,
): Promise<PluginListener> {
  return addPluginListener("voice-wake", "speechRecognitionResult", (raw: unknown) => {
    const event = (raw ?? {}) as {
      ok?: boolean;
      text?: string;
      confidence?: number;
      error?: string;
    };
    if (event.ok && typeof event.text === "string" && event.text.trim()) {
      handler({
        ok: true,
        text: event.text.trim(),
        ...(typeof event.confidence === "number" ? { confidence: event.confidence } : {}),
      });
      return;
    }
    handler({ ok: false, error: event.error?.trim() || "识别失败" });
  });
}
