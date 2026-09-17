import type { SpeechUnsupportedReason } from "./adapter-types.ts";

export function isWebSpeechApiAvailable(): boolean {
  return typeof speechSynthesis !== "undefined";
}

export function isWebSpeechSecureContext(): boolean {
  if (typeof window === "undefined") return true;
  return window.isSecureContext;
}

export function getWebSpeechUnsupportedReason(enabled: boolean): SpeechUnsupportedReason | null {
  if (!enabled) return "disabled";
  if (!isWebSpeechApiAvailable()) return "no_api";
  if (!isWebSpeechSecureContext()) return "insecure_context";
  return null;
}

export function primeWebSpeechSynth(
  synth: SpeechSynthesis | undefined = typeof speechSynthesis !== "undefined"
    ? speechSynthesis
    : undefined,
): void {
  if (!synth) return;
  synth.resume();
}
