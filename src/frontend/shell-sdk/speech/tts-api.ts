import { MAX_HUB_TTS_TEXT_LENGTH } from "./constants.ts";
import { resolveHubApiFetch, resolveHubApiUrl } from "../hub-api-fetch.ts";
import { buildTtsCacheKey, getTtsAudioCache } from "./tts-cache.ts";
import { consumeMpegStream, playMpegBuffer } from "./mpeg-player.ts";

export type HubTtsSynthesizeParams = {
  text: string;
  lang?: string | null;
  voice?: string | null;
  appLocale: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export type HubTtsSynthesizeResult = {
  buffer: ArrayBuffer;
  fromCache: boolean;
  played: boolean;
};

function normalizeHubTtsText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("朗读文本不能为空");
  }
  if (normalized.length > MAX_HUB_TTS_TEXT_LENGTH) {
    throw new Error(`朗读文本过长（最多 ${MAX_HUB_TTS_TEXT_LENGTH} 字）`);
  }
  return normalized;
}

async function postHubTtsSynthesize(params: HubTtsSynthesizeParams): Promise<Response> {
  const text = normalizeHubTtsText(params.text);
  const hubFetch = resolveHubApiFetch();
  const response = await hubFetch(resolveHubApiUrl("/api/tts/synthesize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      lang: params.lang ?? undefined,
      voice: params.voice ?? undefined,
      app_locale: params.appLocale,
      rate: params.rate,
      pitch: params.pitch,
      volume: params.volume,
    }),
  });

  if (!response.ok) {
    let message = "语音合成失败";
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body.error === "string" && body.error.trim()) {
        message = body.error.trim();
      }
    } catch {
      if (response.status === 401) {
        message = "语音合成需要 Hub 认证，请检查 Service API Token";
      }
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Hub 未返回音频流");
  }

  return response;
}

export async function synthesizeSpeechViaHubStream(
  params: HubTtsSynthesizeParams,
  options: { generation: number; play: boolean; onResponse?: () => void },
): Promise<HubTtsSynthesizeResult> {
  const text = normalizeHubTtsText(params.text);
  const cacheParams = { ...params, text };
  const cacheKey = await buildTtsCacheKey(cacheParams);
  const cached = getTtsAudioCache().get(cacheKey);
  if (cached) {
    options.onResponse?.();
    if (options.play) {
      await playMpegBuffer(cached, options.generation);
      return { buffer: cached, fromCache: true, played: true };
    }
    return { buffer: cached, fromCache: true, played: false };
  }

  const response = await postHubTtsSynthesize(cacheParams);
  options.onResponse?.();
  const body = response.body;
  if (!body) {
    throw new Error("Hub 未返回音频流");
  }

  const { buffer, played } = await consumeMpegStream(body, options.generation, options.play);
  getTtsAudioCache().set(cacheKey, buffer);

  return { buffer, fromCache: false, played };
}

/** @deprecated 使用 synthesizeSpeechViaHubStream */
export async function synthesizeSpeechViaHub(params: HubTtsSynthesizeParams): Promise<ArrayBuffer> {
  const result = await synthesizeSpeechViaHubStream(params, { generation: 0, play: false });
  return result.buffer;
}
