import { omitUndefined } from "@freeanima/core/util";
import { Elysia } from "elysia";
import { z } from "zod";
import { createConversationBodySchema } from "../../api/schemas.ts";
import { iterateConversationEvents } from "../../handlers/conversation-events.ts";
import { sseResponse } from "../../sse-response.ts";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

const conversationListQuerySchema = z.object({
  platform: z.string().optional(),
  offset: z.string().optional(),
  limit: z.string().optional(),
});

export const conversationsRoutes = new Elysia({ prefix: "/conversations" })
  .get("/", ({ query }) => {
    const parsed = conversationListQuerySchema.parse(query);
    return invokeConsoleHubHandler(
      "conversation.list",
      omitUndefined({
        platform: parsed.platform,
        offset: parsed.offset ? Number(parsed.offset) : undefined,
        limit: parsed.limit ? Number(parsed.limit) : undefined,
      }),
    );
  })
  .get("/all", () => invokeConsoleHubHandler("conversation.adminListAll", {}))
  .post("/", ({ body }) =>
    invokeConsoleHubHandler(
      "conversation.adminCreate",
      createConversationBodySchema.parse(body ?? {}),
    ),
  )
  .get(
    "/commands",
    ({ query }) =>
      invokeConsoleHubHandler(
        "conversation.commands",
        omitUndefined({
          all: query.all === "true" || query.all === true,
          platform: typeof query.platform === "string" ? query.platform : undefined,
        }),
      ),
    {
      query: z.object({
        all: z.union([z.string(), z.boolean()]).optional(),
        platform: z.string().optional(),
      }),
    },
  )
  .get("/:conversationId", ({ params }) =>
    invokeConsoleHubHandler("conversation.adminGet", { conversationId: params.conversationId }),
  )
  .get("/:conversationId/acp-dock", ({ params }) =>
    invokeConsoleHubHandler("conversation.acpDock", { conversation_id: params.conversationId }),
  )
  .get("/:conversationId/events", ({ params, request }) =>
    sseResponse(iterateConversationEvents(params.conversationId, request.signal), request.signal),
  )
  .get(
    "/:conversationId/messages",
    ({ params, query }) =>
      invokeConsoleHubHandler(
        "conversation.messages",
        omitUndefined({
          conversation_id: params.conversationId,
          offset: query.offset ? Number(query.offset) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
        }),
      ),
    {
      query: z.object({
        offset: z.string().optional(),
        limit: z.string().optional(),
      }),
    },
  )
  .patch(
    "/:conversationId/title",
    ({ params, body }) =>
      invokeConsoleHubHandler("conversation.patchTitle", {
        conversation_id: params.conversationId,
        title: z
          .object({ title: z.string().min(1) })
          .parse(body)
          .title.trim(),
      }),
    {
      body: z.object({ title: z.string().min(1) }),
    },
  );
