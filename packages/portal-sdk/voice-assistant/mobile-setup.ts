import {
  isVoiceWakeSupported,
  readVoiceWakePermission,
  requestVoiceWakePermission,
} from "../voice-wake/index.ts";

export async function ensureVoiceAssistantPermissions(): Promise<boolean> {
  if (!isVoiceWakeSupported()) return false;
  const state = await readVoiceWakePermission();
  if (state === "granted") return true;
  const next = await requestVoiceWakePermission();
  return next === "granted";
}

export function notifyVoiceAssistantPrefsChanged(): void {
  window.dispatchEvent(new Event("freeanima:voice-assistant-prefs"));
}
