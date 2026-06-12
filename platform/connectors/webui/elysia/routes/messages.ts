import { Elysia, sse } from "elysia";
import { z } from "zod";
import { streamApiEventSchema } from "../../api/schemas.ts";
import { iterateMessageStream } from "../../handlers/index.ts";
import { withSseKeepalive } from "../../sse-keepalive.ts";

const sendStreamInputSchema = z
  .object({
    sessionId: z.string(),
    message: z.string(),
  })
  .transform(({ sessionId, message }) => ({
    sessionId,
    message: message.trim(),
  }))
  .refine((v) => v.message.length > 0, { message: "message is required" });

export const messagesRoutes = new Elysia({ prefix: "/messages" }).post(
  "/stream",
  async function* ({ body, request, set }) {
    set.headers["X-Accel-Buffering"] = "no";
    const input = sendStreamInputSchema.parse(body);
    const signal = request.signal;

    for await (const chunk of withSseKeepalive(
      iterateMessageStream(input.sessionId, input.message),
      () => ({ event: "ping", data: JSON.stringify({}) }),
      signal,
    )) {
      if (chunk.event === "ping") {
        yield sse(JSON.stringify({ event: "ping", data: {} }));
        await Bun.sleep(0);
        if (signal.aborted) break;
        continue;
      }
      const event = streamApiEventSchema.parse({
        event: chunk.event,
        data: JSON.parse(chunk.data),
      });
      yield sse(JSON.stringify(event));
      await Bun.sleep(0);
      if (signal.aborted) break;
      if (event.event === "done" || event.event === "error") break;
    }
  },
  {
    body: z.object({
      sessionId: z.string(),
      message: z.string(),
    }),
  },
);
