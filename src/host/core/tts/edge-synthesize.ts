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

export function validateEdgeTtsText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("朗读文本不能为空");
  }
  if (normalized.length > MAX_EDGE_TTS_TEXT_LENGTH) {
    throw new Error(`朗读文本过长（最多 ${MAX_EDGE_TTS_TEXT_LENGTH} 字）`);
  }
  return normalized;
}

export function createEdgeCommunicate(input: EdgeSynthesizeInput): Communicate {
  const text = validateEdgeTtsText(input.text);
  const voice = resolveEdgeVoiceName(
    input.voice ?? null,
    input.lang ?? null,
    input.appLocale ?? "zh-CN",
  );
  const prosody = mapProsodyToEdgeStrings(input.rate, input.pitch, input.volume);

  return new Communicate(text, {
    voice,
    rate: prosody.rate,
    pitch: prosody.pitch,
    volume: prosody.volume,
  });
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

/** 将 Edge TTS 音频流直接 pipe 为 HTTP ReadableStream */
export function streamEdgeTtsAudio(input: EdgeSynthesizeInput): ReadableStream<Uint8Array> {
  let communicate: Communicate;
  try {
    communicate = createEdgeCommunicate(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new ReadableStream({
      start(controller) {
        controller.error(new Error(message));
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let hasAudio = false;
      try {
        for await (const chunk of communicate.stream()) {
          if (chunk.type === "audio" && chunk.data) {
            hasAudio = true;
            controller.enqueue(new Uint8Array(chunk.data));
          }
        }
        if (!hasAudio) {
          controller.error(new Error("Edge TTS 未返回音频"));
          return;
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.error(new Error(`Edge TTS 合成失败：${message}`, { cause: err }));
      }
    },
  });
}

export async function synthesizeEdgeTts(input: EdgeSynthesizeInput): Promise<Buffer> {
  try {
    return await collectCommunicateAudio(createEdgeCommunicate(input));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Edge TTS 合成失败：${message}`, { cause: err });
  }
}
