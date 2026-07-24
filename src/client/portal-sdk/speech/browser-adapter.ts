import type { SpeechPlaybackConfig } from "./types.ts";
import type { SpeechPlaybackAdapter } from "./adapter-types.ts";
import { applyWebSpeechUtteranceOptions, pickWebSpeechVoice } from "./web-speech.ts";
import {
  getWebSpeechUnsupportedReason,
  isWebSpeechApiAvailable,
  primeWebSpeechSynth,
} from "./web-speech-support.ts";

const MAX_CHUNK_LEN = 280;

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
  speechOptions: SpeechPlaybackConfig;
};

let activeSession: ChunkSession | null = null;
const VOICES_TIMEOUT_MS = 800;

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
  applyWebSpeechUtteranceOptions(utterance, session.speechOptions, session.locale, session.voice);

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

function waitForVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const finish = (voices: SpeechSynthesisVoice[]) => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      clearTimeout(timer);
      resolve(voices);
    };
    const onVoicesChanged = () => finish(synth.getVoices());
    const timer = setTimeout(() => finish(synth.getVoices()), VOICES_TIMEOUT_MS);
    synth.addEventListener("voiceschanged", onVoicesChanged);
    synth.getVoices();
  });
}

export function createBrowserSpeechAdapter(
  synth: SpeechSynthesis | undefined = typeof speechSynthesis !== "undefined"
    ? speechSynthesis
    : undefined,
  speechOptions?: SpeechPlaybackConfig,
): SpeechPlaybackAdapter {
  const options: SpeechPlaybackConfig = speechOptions ?? {
    enabled: true,
    provider: "web-speech",
    lang: null,
    voiceName: null,
    preferLocal: true,
    rate: 1,
    pitch: 1,
    volume: 1,
    previewText: "",
  };

  return {
    isSupported: () => getWebSpeechUnsupportedReason(options.enabled) === null,

    stop() {
      if (!synth) return;
      activeSession = null;
      synth.cancel();
    },

    speak(text, locale, onEnd, onError) {
      if (!synth || getWebSpeechUnsupportedReason(options.enabled) !== null) {
        onError?.();
        return;
      }

      const chunks = splitTextForSpeech(text);
      if (chunks.length === 0) {
        onEnd();
        return;
      }

      primeWebSpeechSynth(synth);
      synth.cancel();
      activeSession = null;

      void (async () => {
        try {
          const voices = await waitForVoices(synth);
          const session: ChunkSession = {
            chunks,
            index: 0,
            onEnd,
            voice: pickWebSpeechVoice(voices, options, locale),
            locale,
            speechOptions: options,
            ...(onError ? { onError } : {}),
          };
          activeSession = session;
          speakNextChunk(synth, session);
        } catch {
          onError?.();
        }
      })();
    },
  };
}

export function isBrowserSpeechSupported(enabled = true): boolean {
  return isWebSpeechApiAvailable() && getWebSpeechUnsupportedReason(enabled) === null;
}
