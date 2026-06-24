import { Elysia } from "elysia";
import { z } from "zod";
import { createConversationBodySchema } from "../../api/schemas.ts";
import {
  createConversation,
  getConversationInfo,
  getStoredMessages,
  listCommands,
  listConversations,
  setConversationTitle,
} from "../../handlers/index.ts";
import {
  fetchConversationAcpDock,
  iterateConversationEvents,
} from "../../handlers/conversation-events.ts";
import { sseResponse } from "../../sse-response.ts";

const conversationListQuerySchema = z.object({
  platform: z.string().optional(),
  offset: z.string().optional(),
  limit: z.string().optional(),
});

export const conversationsRoutes = new Elysia({ prefix: "/conversations" })
  .get("/", ({ query }) => {
    const parsed = conversationListQuerySchema.parse(query);
    return listConversations(parsed.platform, {
      offset: parsed.offset ? Number(parsed.offset) : undefined,
      limit: parsed.limit ? Number(parsed.limit) : undefined,
    });
  })
  .get("/all", () => listConversations(undefined, { offset: 0, limit: 10_000 }))
  .post("/", ({ body }) => createConversation(createConversationBodySchema.parse(body ?? {})))
  .get(
    "/commands",
    ({ query }) =>
      listCommands({
        all: query.all === "true" || query.all === true,
        platform: typeof query.platform === "string" ? query.platform : undefined,
      }),
    {
      query: z.object({
        all: z.union([z.string(), z.boolean()]).optional(),
        platform: z.string().optional(),
      }),
    },
  )
  .get("/:conversationId", ({ params }) => getConversationInfo(params.conversationId))
  .get("/:conversationId/acp-dock", ({ params }) => fetchConversationAcpDock(params.conversationId))
  .get("/:conversationId/events", ({ params, request }) =>
    sseResponse(iterateConversationEvents(params.conversationId, request.signal), request.signal),
  )
  .get(
    "/:conversationId/messages",
    ({ params, query }) =>
      getStoredMessages(params.conversationId, {
        offset: query.offset ? Number(query.offset) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      }),
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
      setConversationTitle(params.conversationId, {
        title: z
          .object({ title: z.string().min(1) })
          .parse(body)
          .title.trim(),
      }),
    {
      body: z.object({ title: z.string().min(1) }),
    },
  );
