import type { SpeechPlaybackAdapter } from "./types.ts";

const MAX_CHUNK_LEN = 280;

function localeToLang(locale: string): string {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function pickVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const lang = localeToLang(locale);
  const matched = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  return matched.find((v) => v.localService) ?? matched[0] ?? null;
}

export function splitTextForSpeech(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const parts = normalized.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if (current.length + part.length > MAX_CHUNK_LEN) {
      if (current.trim()) chunks.push(current.trim());
      if (part.length > MAX_CHUNK_LEN) {
        for (let i = 0; i < part.length; i += MAX_CHUNK_LEN) {
          chunks.push(part.slice(i, i + MAX_CHUNK_LEN).trim());
        }
        current = "";
      } else {
        current = part;
      }
    } else {
      current += part;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [normalized];
}

type ChunkSession = {
  chunks: string[];
  index: number;
  onEnd: () => void;
  onError?: () => void;
  voice: SpeechSynthesisVoice | null;
  locale: string;
};

let activeSession: ChunkSession | null = null;

function finishSession(session: ChunkSession, errored = false): void {
  if (activeSession === session) activeSession = null;
  if (errored) session.onError?.();
  else session.onEnd();
}

function speakNextChunk(synth: SpeechSynthesis, session: ChunkSession): void {
  const chunk = session.chunks[session.index];
  if (!chunk) {
    finishSession(session);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(chunk);
  utterance.lang = session.locale === "zh-cn" ? "zh-CN" : "en-US";
  if (session.voice) utterance.voice = session.voice;

  utterance.addEventListener("end", () => {
    session.index += 1;
    if (session.index >= session.chunks.length) {
      finishSession(session);
      return;
    }
    speakNextChunk(synth, session);
  });
  utterance.addEventListener("error", () => finishSession(session, true));

  synth.speak(utterance);
}

export function createBrowserSpeechAdapter(
  synth: SpeechSynthesis | undefined = typeof speechSynthesis !== "undefined"
    ? speechSynthesis
    : undefined,
): SpeechPlaybackAdapter {
  return {
    isSupported: () => Boolean(synth),

    stop() {
      if (!synth) return;
      activeSession = null;
      synth.cancel();
    },

    speak(text, locale, onEnd, onError) {
      if (!synth) {
        onError?.();
        return;
      }

      const chunks = splitTextForSpeech(text);
      if (chunks.length === 0) {
        onEnd();
        return;
      }

      synth.cancel();
      activeSession = null;

      const start = (voice: SpeechSynthesisVoice | null) => {
        const session: ChunkSession = {
          chunks,
          index: 0,
          onEnd,
          onError,
          voice,
          locale,
        };
        activeSession = session;
        speakNextChunk(synth, session);
      };

      const voices = synth.getVoices();
      if (voices.length > 0) {
        start(pickVoice(voices, locale));
        return;
      }

      const onVoicesChanged = () => {
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        start(pickVoice(synth.getVoices(), locale));
      };
      synth.addEventListener("voiceschanged", onVoicesChanged);
    },
  };
}
