import { synthesizeVoiceFromScene } from "@freeanima/habitat/capabilities/llm-openai/voice-synthesize";
import { getResolvedSpeechConfig } from "@freeanima/habitat/core/config/tts-helpers";
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
  try {
    speech = getResolvedSpeechConfig(getActiveRuntimeConfig().data);
  } catch {
    speech = null;
  }

  if (speech && speech.provider === "web-speech") {
    throw new ApiHandlerError(400, "当前为浏览器本机朗读，请由客户端直接合成");
  }

  try {
    const result = await synthesizeVoiceFromScene({
      text: parsed.text,
      purpose: "tts",
      prosody: {
        ...(parsed.voice?.trim()
          ? { voice: parsed.voice.trim() }
          : speech?.voiceName
            ? { voice: speech.voiceName }
            : {}),
        ...(parsed.lang?.trim()
          ? { language: parsed.lang.trim() }
          : speech?.lang
            ? { language: speech.lang }
            : {}),
        ...(parsed.rate !== undefined
          ? { rate: parsed.rate }
          : speech
            ? { rate: speech.rate }
            : {}),
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
      },
    });

    if ("error" in result) {
      const message = result.error;
      if (message.includes("过长") || message.includes("不能为空")) {
        throw new ApiHandlerError(400, message);
      }
      throw new ApiHandlerError(503, message);
    }

    return new Response(Buffer.from(result.bytes), {
      headers: {
        "content-type": result.mimeType || "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ApiHandlerError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("过长") || message.includes("不能为空")) {
      throw new ApiHandlerError(400, message);
    }
    throw new ApiHandlerError(503, message);
  }
};
