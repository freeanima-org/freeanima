import { streamEdgeTtsAudio } from "@freeanima/core/tts/edge-synthesize";
import { assertNotShuttingDown } from "@freeanima/platform/ports";
import type { FeatureRpcHandler } from "@freeanima/platform/features";

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

  try {
    const stream = streamEdgeTtsAudio({
      text: parsed.text,
      lang: parsed.lang ?? null,
      voice: parsed.voice ?? null,
      appLocale: parsed.app_locale ?? "zh-CN",
      ...(parsed.rate !== undefined ? { rate: parsed.rate } : {}),
      ...(parsed.pitch !== undefined ? { pitch: parsed.pitch } : {}),
      ...(parsed.volume !== undefined ? { volume: parsed.volume } : {}),
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
