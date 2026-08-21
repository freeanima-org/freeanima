import { isRecord } from "@freeanima/shared/util";
import { buildHabitatRestRequest } from "@freeanima/shared/habitat-rpc";

import { resolveBinarySafeHabitatFetch } from "../habitat-api-fetch.ts";
import { resolveHabitatApiOrigin } from "../habitat-api-origin.ts";
import { MAX_HABITAT_TTS_TEXT_LENGTH } from "./constants.ts";
import { buildTtsCacheKey, getTtsAudioCache } from "./tts-cache.ts";
import { consumeMpegStream, playMpegBuffer } from "./mpeg-player.ts";

export type HabitatTtsSynthesizeParams = {
  text: string;
  lang?: string | null;
  voice?: string | null;
  appLocale: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export type HabitatTtsSynthesizeResult = {
  buffer: ArrayBuffer;
  fromCache: boolean;
  played: boolean;
};

function normalizeHubTtsText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("朗读文本不能为空");
  }
  if (normalized.length > MAX_HABITAT_TTS_TEXT_LENGTH) {
    throw new Error(`朗读文本过长（最多 ${MAX_HABITAT_TTS_TEXT_LENGTH} 字）`);
  }
  return normalized;
}

async function postHubTtsSynthesize(params: HabitatTtsSynthesizeParams): Promise<Response> {
  const text = normalizeHubTtsText(params.text);
  // 不可用 resolveHabitatApiFetch / shell.habitatFetch：避免中间层损坏 MP3 字节
  const habitatFetch = resolveBinarySafeHabitatFetch();
  const { url, init } = buildHabitatRestRequest(resolveHabitatApiOrigin(), "tts.synthesize", {
    text,
    lang: params.lang ?? undefined,
    voice: params.voice ?? undefined,
    app_locale: params.appLocale,
    rate: params.rate,
    pitch: params.pitch,
    volume: params.volume,
  });
  const response = await habitatFetch(url, init);

  if (!response.ok) {
    let message = "语音合成失败";
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
      if (response.status === 401) {
        message = "语音合成需要栖息地认证，请检查 Service API Token";
      }
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("栖息地未返回音频流");
  }

  return response;
}

export async function synthesizeSpeechViaHubStream(
  params: HabitatTtsSynthesizeParams,
  options: { generation: number; play: boolean; onResponse?: () => void },
): Promise<HabitatTtsSynthesizeResult> {
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
    throw new Error("栖息地未返回音频流");
  }

  const { buffer, played } = await consumeMpegStream(body, options.generation, options.play);
  getTtsAudioCache().set(cacheKey, buffer);

  return { buffer, fromCache: false, played };
}

/** 进行中的预取；与播放 generation 解耦，避免 speak/stop bump 取消下一句预合成 */
const inFlightPrefetch = new Map<string, Promise<void>>();

/**
 * 仅写入 TTS 缓存，不播放、不绑定 playbackGeneration。
 * 供队列队首预取；speak 命中缓存即可立刻播。
 */
export async function prefetchHabitatTtsToCache(
  params: HabitatTtsSynthesizeParams,
): Promise<{ fromCache: boolean }> {
  const text = normalizeHubTtsText(params.text);
  const cacheParams = { ...params, text };
  const cacheKey = await buildTtsCacheKey(cacheParams);
  if (getTtsAudioCache().get(cacheKey)) {
    return { fromCache: true };
  }

  const existing = inFlightPrefetch.get(cacheKey);
  if (existing) {
    await existing;
    return { fromCache: true };
  }

  const task = (async () => {
    const response = await postHubTtsSynthesize(cacheParams);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error("栖息地返回空音频");
    }
    getTtsAudioCache().set(cacheKey, buffer);
  })().finally(() => {
    inFlightPrefetch.delete(cacheKey);
  });

  inFlightPrefetch.set(cacheKey, task);
  await task;
  return { fromCache: false };
}
