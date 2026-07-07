import { Communicate } from "edge-tts-universal";

import { resolveEdgeVoiceName } from "./edge-voices.ts";

export const MAX_EDGE_TTS_TEXT_LENGTH = 4096;

export type EdgeSynthesizeInput = {
  text: string;
  lang?: string | null;
  voice?: string | null;
  appLocale?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export type EdgeProsodyStrings = {
  rate: string;
  pitch: string;
  volume: string;
};

function formatSignedPercent(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

function formatSignedHz(value: number): string {
  return value >= 0 ? `+${value}Hz` : `${value}Hz`;
}

export function mapProsodyToEdgeStrings(rate = 1, pitch = 1, volume = 1): EdgeProsodyStrings {
  const ratePct = Math.round((rate - 1) * 100);
  const pitchHz = Math.round((pitch - 1) * 50);
  const volumePct = Math.round((volume - 1) * 100);

  return {
    rate: formatSignedPercent(ratePct),
    pitch: formatSignedHz(pitchHz),
    volume: formatSignedPercent(volumePct),
  };
}

export async function collectCommunicateAudio(communicate: Communicate): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of communicate.stream()) {
    if (chunk.type === "audio" && chunk.data) {
      chunks.push(chunk.data);
    }
  }
  if (chunks.length === 0) {
    throw new Error("Edge TTS 未返回音频");
  }
  return Buffer.concat(chunks);
}

export async function synthesizeEdgeTts(input: EdgeSynthesizeInput): Promise<Buffer> {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!text) {
    throw new Error("朗读文本不能为空");
  }
  if (text.length > MAX_EDGE_TTS_TEXT_LENGTH) {
    throw new Error(`朗读文本过长（最多 ${MAX_EDGE_TTS_TEXT_LENGTH} 字）`);
  }

  const voice = resolveEdgeVoiceName(
    input.voice ?? null,
    input.lang ?? null,
    input.appLocale ?? "zh-CN",
  );
  const prosody = mapProsodyToEdgeStrings(input.rate, input.pitch, input.volume);

  const communicate = new Communicate(text, {
    voice,
    rate: prosody.rate,
    pitch: prosody.pitch,
    volume: prosody.volume,
  });

  try {
    return await collectCommunicateAudio(communicate);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Edge TTS 合成失败：${message}`, { cause: err });
  }
}
