import type { SpeechPlaybackConfig } from "@freeanima/shell-sdk/speech/types";
import {
  applyWebSpeechUtteranceOptions,
  pickWebSpeechVoice,
} from "@freeanima/shell-sdk/speech/web-speech";

import type { SpeechPlaybackAdapter } from "./types.ts";

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

export function createBrowserSpeechAdapter(
  synth: SpeechSynthesis | undefined = typeof speechSynthesis !== "undefined"
    ? speechSynthesis
    : undefined,
  speechOptions?: SpeechPlaybackConfig,
): SpeechPlaybackAdapter {
  const options: SpeechPlaybackConfig = speechOptions ?? {
    enabled: true,
    lang: null,
    voiceName: null,
    preferLocal: true,
    rate: 1,
    pitch: 1,
    volume: 1,
    previewText: "",
  };

  return {
    isSupported: () => Boolean(synth) && options.enabled,

    stop() {
      if (!synth) return;
      activeSession = null;
      synth.cancel();
    },

    speak(text, locale, onEnd, onError) {
      if (!synth || !options.enabled) {
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
          speechOptions: options,
        };
        activeSession = session;
        speakNextChunk(synth, session);
      };

      const voices = synth.getVoices();
      if (voices.length > 0) {
        start(pickWebSpeechVoice(voices, options, locale));
        return;
      }

      const onVoicesChanged = () => {
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        start(pickWebSpeechVoice(synth.getVoices(), options, locale));
      };
      synth.addEventListener("voiceschanged", onVoicesChanged);
    },
  };
}
