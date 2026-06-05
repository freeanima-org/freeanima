import { z } from "zod";
import { streamApiEventSchema } from "../../api/schemas.ts";
import { iterateMessageStream } from "../../handlers/index.ts";
import { publicProcedure, router } from "../trpc.ts";

export const messagesRouter = router({
  sendStream: publicProcedure
    .input(
      z
        .object({
          sessionId: z.string(),
          message: z.string(),
        })
        .transform(({ sessionId, message }) => ({
          sessionId,
          message: message.trim(),
        }))
        .refine((v) => v.message.length > 0, { message: "message is required" }),
    )
    .subscription(async function* ({ input, signal }) {
      for await (const chunk of iterateMessageStream(input.sessionId, input.message)) {
        const event = streamApiEventSchema.parse({
          event: chunk.event,
          data: JSON.parse(chunk.data),
        });
        yield event;
        if (signal?.aborted) break;
        if (event.event === "done" || event.event === "error") break;
      }
    }),
});
