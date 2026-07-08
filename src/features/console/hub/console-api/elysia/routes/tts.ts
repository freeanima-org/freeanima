import { Elysia } from "elysia";
import { z } from "zod";
import { ApiHandlerError } from "../../handlers/errors.ts";
import { streamEdgeTtsAudio } from "@freeanima/core/tts/edge-synthesize";

const synthesizeBodySchema = z.object({
  text: z.string().min(1),
  lang: z.string().optional(),
  voice: z.string().optional(),
  app_locale: z.string().optional(),
  rate: z.number().min(0.1).max(10).optional(),
  pitch: z.number().min(0).max(2).optional(),
  volume: z.number().min(0).max(1).optional(),
});

export const ttsRoutes = new Elysia({ prefix: "/tts" }).post("/synthesize", async ({ body }) => {
  let parsed: z.infer<typeof synthesizeBodySchema>;
  try {
    parsed = synthesizeBodySchema.parse(body);
  } catch {
    throw new ApiHandlerError(400, "请求体无效");
  }

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
});
