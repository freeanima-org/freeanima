import { isRecord } from "@freeanima/shared/util";

const PREFS_KEY = "freeanima.voiceAssistant";

export type VoiceAssistantPrefs = {
  wakeEnabled: boolean;
  wakePhrase: string;
  preferCloudAsr: boolean;
  sensitivity: number;
  llmFallbackWifiOnly: boolean;
};

const DEFAULT_PREFS: VoiceAssistantPrefs = {
  wakeEnabled: false,
  wakePhrase: "小风",
  preferCloudAsr: false,
  sensitivity: 0.55,
  llmFallbackWifiOnly: false,
};

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readVoiceAssistantPrefs(): VoiceAssistantPrefs {
  const raw = storage()?.getItem(PREFS_KEY);
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { ...DEFAULT_PREFS };
    }
    const obj = parsed;
    return {
      wakeEnabled: obj.wakeEnabled === true,
      wakePhrase:
        typeof obj.wakePhrase === "string" && obj.wakePhrase.trim()
          ? obj.wakePhrase.trim()
          : DEFAULT_PREFS.wakePhrase,
      preferCloudAsr: obj.preferCloudAsr === true,
      sensitivity:
        typeof obj.sensitivity === "number" && Number.isFinite(obj.sensitivity)
          ? Math.min(1, Math.max(0, obj.sensitivity))
          : DEFAULT_PREFS.sensitivity,
      llmFallbackWifiOnly: obj.llmFallbackWifiOnly === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writeVoiceAssistantPrefs(patch: Partial<VoiceAssistantPrefs>): VoiceAssistantPrefs {
  const next = { ...readVoiceAssistantPrefs(), ...patch };
  storage()?.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}
