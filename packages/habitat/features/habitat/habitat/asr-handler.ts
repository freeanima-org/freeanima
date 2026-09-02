import { transcribeAsrFromScene } from "@freeanima/habitat/capabilities/llm-openai/asr-transcribe";
import { assertNotShuttingDown } from "@freeanima/habitat/platform/ports";
import type { FeatureRpcHandler } from "@freeanima/habitat/platform/features";
import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";

import { ApiHandlerError } from "./habitat-api/handlers/errors.ts";
import type { HabitatDispatchContext } from "@freeanima/habitat/platform/habitat/dispatch.ts";

type AsrTranscribeQuery = {
  mime_type?: string;
  language?: string;
};

function requireHttpRequest(ctx: HabitatDispatchContext): Request {
  if (!ctx.httpRequest) {
    throw new ApiHandlerError(400, "asr.transcribe 需要 HTTP 请求上下文");
  }
  return ctx.httpRequest;
}

export const handleAsrTranscribe: FeatureRpcHandler = async (_deps, payload, ctx) => {
  assertNotShuttingDown();
  const parsed = assertNarrow<AsrTranscribeQuery>(payload);
  const request = requireHttpRequest(ctx);
  const bytes = new Uint8Array(await request.arrayBuffer());
  const mimeType =
    parsed.mime_type?.trim() ||
    request.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";

  try {
    const result = await transcribeAsrFromScene({
      bytes,
      mimeType,
      ...(parsed.language?.trim() ? { language: parsed.language.trim() } : {}),
    });

    if ("error" in result) {
      const message = result.error;
      if (message.includes("为空") || message.includes("过大")) {
        throw new ApiHandlerError(400, message);
      }
      throw new ApiHandlerError(503, message);
    }

    return result;
  } catch (err) {
    if (err instanceof ApiHandlerError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiHandlerError(503, message);
  }
};
