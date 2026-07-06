import { Elysia } from "elysia";
import { z } from "zod";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

const promptDebugQuerySchema = z.object({
  conversation_id: z.string().optional(),
});

export const promptRoutes = new Elysia({ prefix: "/prompt" }).get("/debug", ({ query }) => {
  const parsed = promptDebugQuerySchema.parse(query);
  return invokeConsoleHubHandler("prompt.debug", parsed);
});
