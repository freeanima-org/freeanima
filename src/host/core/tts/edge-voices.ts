/** 常用 Edge Neural 语音（设置页与默认解析） */
export const EDGE_TTS_VOICE_OPTIONS = [
  { name: "zh-CN-XiaoxiaoNeural", lang: "zh-CN", label: "晓晓（女声）" },
  { name: "zh-CN-YunxiNeural", lang: "zh-CN", label: "云希（男声）" },
  { name: "zh-CN-XiaoyiNeural", lang: "zh-CN", label: "晓伊（女声）" },
  { name: "zh-CN-YunjianNeural", lang: "zh-CN", label: "云健（男声）" },
  { name: "en-US-JennyNeural", lang: "en-US", label: "Jenny (female)" },
  { name: "en-US-GuyNeural", lang: "en-US", label: "Guy (male)" },
  { name: "en-US-AriaNeural", lang: "en-US", label: "Aria (female)" },
] as const;

export function resolveSpeechLang(configLang: string | null, appLocale: string): string {
  const trimmed = configLang?.trim();
  if (trimmed) return trimmed;
  if (appLocale.toLowerCase().startsWith("zh")) return "zh-CN";
  return "en-US";
}

export function resolveEdgeVoiceName(
  voiceName: string | null,
  lang: string | null,
  appLocale: string,
): string {
  const trimmed = voiceName?.trim();
  if (trimmed) return trimmed;

  const targetLang = resolveSpeechLang(lang, appLocale).toLowerCase();
  if (targetLang.startsWith("zh")) return "zh-CN-XiaoxiaoNeural";
  return "en-US-JennyNeural";
}
