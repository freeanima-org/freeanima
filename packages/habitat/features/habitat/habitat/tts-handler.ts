import { streamEdgeTtsAudio } from "@freeanima/habitat/core/tts/edge-synthesize";
import {
  edgeTtsProxyFromBaseUrl,
  getResolvedSpeechConfig,
  resolveEdgeTtsConnection,
} from "@freeanima/habitat/core/config/tts-helpers";
import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { assertNotShuttingDown } from "@freeanima/habitat/platform/ports";
import type { FeatureRpcHandler } from "@freeanima/habitat/platform/features";

import { ApiHandlerError } from "./habitat-api/handlers/errors.ts";

type TtsSynthesizePayload = {
  text: string;
  lang?: string;
  voice?: string;
  app_locale?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export const handleTtsSynthesize: FeatureRpcHandler = async (_deps, payload) => {
  assertNotShuttingDown();
  const parsed = payload as TtsSynthesizePayload;

  let speech;
  let edgeConn;
  try {
    const cfg = getActiveRuntimeConfig().data;
    speech = getResolvedSpeechConfig(cfg);
    edgeConn = resolveEdgeTtsConnection(cfg);
  } catch {
    speech = null;
    edgeConn = null;
  }

  const proxy = edgeTtsProxyFromBaseUrl(edgeConn?.baseUrl);

  try {
    const stream = streamEdgeTtsAudio({
      text: parsed.text,
      lang: parsed.lang ?? speech?.lang ?? null,
      voice: parsed.voice ?? speech?.voiceName ?? edgeConn?.voiceHint ?? null,
      appLocale: parsed.app_locale ?? "zh-CN",
      ...(parsed.rate !== undefined ? { rate: parsed.rate } : speech ? { rate: speech.rate } : {}),
      ...(parsed.pitch !== undefined
        ? { pitch: parsed.pitch }
        : speech
          ? { pitch: speech.pitch }
          : {}),
      ...(parsed.volume !== undefined
        ? { volume: parsed.volume }
        : speech
          ? { volume: speech.volume }
          : {}),
      ...(proxy ? { proxy } : {}),
    });
    return new Response(stream, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("过长") || message.includes("不能为空")) {
      throw new ApiHandlerError(400, message);
    }
    throw new ApiHandlerError(503, message);
  }
};
