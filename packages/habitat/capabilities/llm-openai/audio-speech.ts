import { createOpenAiClientFromParsed } from "./client.ts";

export type GenerateSpeechInput = {
  apiKey: string;
  baseUrl: string;
  model: string;
  text: string;
  voice?: string;
  speed?: number;
  responseFormat?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
  timeoutMs?: number;
};

export type GenerateSpeechResult = {
  bytes: Uint8Array;
  mimeType: string;
};

function mimeForFormat(format: string): string {
  switch (format) {
    case "wav":
      return "audio/wav";
    case "pcm":
      return "audio/pcm";
    case "opus":
      return "audio/opus";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    default:
      return "audio/mpeg";
  }
}

/** OpenAI-compatible POST …/audio/speech → audio bytes */
export async function generateOpenAiSpeech(
  input: GenerateSpeechInput,
): Promise<GenerateSpeechResult> {
  const format = input.responseFormat ?? "mp3";
  const client = createOpenAiClientFromParsed({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl.replace(/\/$/, ""),
    ...(input.timeoutMs != null ? { timeoutMs: input.timeoutMs } : {}),
  });

  const res = await client.audio.speech.create({
    model: input.model,
    input: input.text,
    voice: input.voice?.trim() || "alloy",
    response_format: format,
    ...(input.speed != null ? { speed: input.speed } : {}),
  });

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("文生声未返回音频数据");
  }
  return { bytes, mimeType: mimeForFormat(format) };
}
