import { Elysia } from "elysia";
import { z } from "zod";
import { streamApiEventSchema } from "../../api/schemas.ts";
import { iterateMessageStream } from "../../handlers/index.ts";

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
  async function* ({ body, request }) {
    const input = sendStreamInputSchema.parse(body);
    const signal = request.signal;

    for await (const chunk of iterateMessageStream(input.sessionId, input.message)) {
      const event = streamApiEventSchema.parse({
        event: chunk.event,
        data: JSON.parse(chunk.data),
      });
      yield `data: ${JSON.stringify(event)}\n\n`;
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
