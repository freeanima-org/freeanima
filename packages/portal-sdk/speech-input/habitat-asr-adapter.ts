import { buildHabitatRestRequest } from "@freeanima/shared/habitat-rpc";

import { resolveBinarySafeHabitatFetch } from "../habitat-api-fetch.ts";
import { resolveHabitatApiOrigin } from "../habitat-api-origin.ts";
import { isRecord } from "@freeanima/shared/util";
import type { SpeechInputAdapter, SpeechInputResult } from "./types.ts";

const MAX_ASR_BYTES = 8 * 1024 * 1024;

async function postHubAsrTranscribe(audio: Blob): Promise<SpeechInputResult> {
  if (audio.size <= 0) throw new Error("音频为空");
  if (audio.size > MAX_ASR_BYTES) throw new Error("音频过大");
  const habitatFetch = resolveBinarySafeHabitatFetch();
  const { url, init } = buildHabitatRestRequest(
    resolveHabitatApiOrigin(),
    "asr.transcribe",
    {
      mime_type: audio.type || "audio/wav",
      language: "zh",
    },
    undefined,
    { body: await audio.arrayBuffer() },
  );
  const response = await habitatFetch(url, init);
  if (!response.ok) {
    let message = "语音识别失败";
    try {
      const body: unknown = await response.json();
      if (isRecord(body)) {
        if (
          isRecord(body.error) &&
          typeof body.error.message === "string" &&
          body.error.message.trim()
        ) {
          message = body.error.message.trim();
        } else if (typeof body.error === "string" && body.error.trim()) {
          message = body.error.trim();
        }
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.text !== "string") {
    throw new Error("栖息地返回格式无效");
  }
  const text = body.text.trim();
  if (!text) throw new Error("识别结果为空");
  const confidence =
    typeof body.confidence === "number" && Number.isFinite(body.confidence) ? body.confidence : 0.9;
  return { text, confidence, source: "habitat" };
}

export function createHabitatAsrAdapter(): SpeechInputAdapter {
  return {
    id: "habitat",
    isSupported: () => true,
    transcribe: async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try {
        const blob = await recordMicBlob(stream, 8_000);
        return await postHubAsrTranscribe(blob);
      } finally {
        for (const track of stream.getTracks()) track.stop();
      }
    },
  };
}

async function recordMicBlob(stream: MediaStream, maxDurationMs: number): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("当前环境不支持 MediaRecorder");
  }
  const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  await new Promise<void>((resolve, reject) => {
    recorder.addEventListener("dataavailable", (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    });
    recorder.addEventListener("error", () => reject(new Error("录音失败")));
    recorder.addEventListener("stop", () => resolve());
    recorder.start(250);
    window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, maxDurationMs);
  });
  return new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
}

/** 将已有音频 blob 送 Hub ASR（Android 录音失败时的兜底）。 */
export async function transcribeAudioBlobViaHub(audio: Blob): Promise<SpeechInputResult> {
  return postHubAsrTranscribe(audio);
}
