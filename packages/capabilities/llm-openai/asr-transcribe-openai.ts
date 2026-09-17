import { createOpenAiClientFromParsed } from "./client.ts";

export type TranscribeSpeechInput = {
  apiKey: string;
  baseUrl: string;
  model: string;
  bytes: Uint8Array;
  mimeType?: string;
  language?: string;
  timeoutMs?: number;
};

export type TranscribeSpeechResult = {
  text: string;
  confidence?: number;
};

function fileNameForMime(mimeType: string | undefined): string {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("wav")) return "audio.wav";
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "audio.mp3";
  if (mime.includes("mp4")) return "audio.mp4";
  return "audio.webm";
}

/** OpenAI-compatible POST …/audio/transcriptions */
export async function transcribeOpenAiSpeech(
  input: TranscribeSpeechInput,
): Promise<TranscribeSpeechResult> {
  const client = createOpenAiClientFromParsed({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl.replace(/\/$/, ""),
    ...(input.timeoutMs != null ? { timeoutMs: input.timeoutMs } : {}),
  });

  const mime = input.mimeType?.trim() || "audio/webm";
  const bytes = new Uint8Array(input.bytes);
  const file = new File([bytes], fileNameForMime(mime), { type: mime });
  const res = await client.audio.transcriptions.create({
    file,
    model: input.model,
    ...(input.language?.trim() ? { language: input.language.trim() } : {}),
  });

  const text = typeof res.text === "string" ? res.text.trim() : "";
  if (!text) {
    throw new Error("语音识别返回空文本");
  }
  return { text, confidence: 0.9 };
}
