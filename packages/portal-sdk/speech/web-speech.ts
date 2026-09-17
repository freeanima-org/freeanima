import type { SpeechPlaybackConfig } from "./types.ts";

export type WebSpeechVoiceInfo = {
  name: string;
  lang: string;
  localService: boolean;
};

export type WebSpeechPreviewOptions = Pick<
  SpeechPlaybackConfig,
  "lang" | "voiceName" | "preferLocal" | "rate" | "pitch" | "volume"
>;

function localeToLang(locale: string): string {
  if (locale.toLowerCase().startsWith("zh")) return "zh-CN";
  return "en-US";
}

export function resolveSpeechLang(configLang: string | null, appLocale: string): string {
  const trimmed = configLang?.trim();
  if (trimmed) return trimmed;
  return localeToLang(appLocale);
}

export function listWebSpeechVoices(
  synth: SpeechSynthesis | undefined = typeof speechSynthesis !== "undefined"
    ? speechSynthesis
    : undefined,
): WebSpeechVoiceInfo[] {
  if (!synth) return [];
  return synth.getVoices().map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
  }));
}

export function pickWebSpeechVoice(
  voices: SpeechSynthesisVoice[],
  options: WebSpeechPreviewOptions,
  appLocale: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const targetLang = resolveSpeechLang(options.lang, appLocale).toLowerCase();
  const byLang = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(targetLang.slice(0, 2)),
  );
  const pool = byLang.length > 0 ? byLang : voices;

  const voiceQuery = options.voiceName?.trim().toLowerCase();
  if (voiceQuery) {
    const named =
      pool.find((voice) => voice.name.toLowerCase() === voiceQuery) ??
      pool.find((voice) => voice.name.toLowerCase().includes(voiceQuery));
    if (named) return named;
  }

  if (options.preferLocal) {
    return pool.find((voice) => voice.localService) ?? pool[0] ?? null;
  }

  return pool[0] ?? null;
}

export function applyWebSpeechUtteranceOptions(
  utterance: SpeechSynthesisUtterance,
  options: WebSpeechPreviewOptions,
  appLocale: string,
  voice: SpeechSynthesisVoice | null,
): void {
  utterance.lang = resolveSpeechLang(options.lang, appLocale);
  utterance.rate = options.rate;
  utterance.pitch = options.pitch;
  utterance.volume = options.volume;
  if (voice) utterance.voice = voice;
}

let previewUtterance: SpeechSynthesisUtterance | null = null;

export function stopWebSpeechPreview(
  synth: SpeechSynthesis | undefined = typeof speechSynthesis !== "undefined"
    ? speechSynthesis
    : undefined,
): void {
  if (!synth) return;
  previewUtterance = null;
  synth.cancel();
}

export function previewWebSpeech(
  text: string,
  options: WebSpeechPreviewOptions,
  appLocale: string,
  synth: SpeechSynthesis | undefined = typeof speechSynthesis !== "undefined"
    ? speechSynthesis
    : undefined,
): Promise<void> {
  if (!synth) {
    return Promise.reject(new Error("当前环境不支持 Web Speech API"));
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return Promise.reject(new Error("试听文本不能为空"));
  }

  stopWebSpeechPreview(synth);

  return new Promise((resolve, reject) => {
    const start = (voice: SpeechSynthesisVoice | null) => {
      const utterance = new SpeechSynthesisUtterance(trimmed);
      applyWebSpeechUtteranceOptions(utterance, options, appLocale, voice);
      previewUtterance = utterance;

      utterance.addEventListener("end", () => {
        if (previewUtterance === utterance) previewUtterance = null;
        resolve();
      });
      utterance.addEventListener("error", () => {
        if (previewUtterance === utterance) previewUtterance = null;
        reject(new Error("语音播放失败"));
      });

      synth.speak(utterance);
    };

    const voices = synth.getVoices();
    if (voices.length > 0) {
      start(pickWebSpeechVoice(voices, options, appLocale));
      return;
    }

    const onVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      start(pickWebSpeechVoice(synth.getVoices(), options, appLocale));
    };
    synth.addEventListener("voiceschanged", onVoicesChanged);
  });
}
