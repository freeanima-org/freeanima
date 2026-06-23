import { Elysia } from "elysia";
import { z } from "zod";
import { createSessionBodySchema } from "../../api/schemas.ts";
import {
  createSession,
  getSessionInfo,
  getSessionMessages,
  listCommands,
  listSessions,
  setSessionTitle,
} from "../../handlers/index.ts";
import { fetchSessionAcpDock, iterateSessionEvents } from "../../handlers/session-events.ts";
import { sseResponse } from "../../sse-response.ts";

const sessionListQuerySchema = z.object({
  platform: z.string().optional(),
  offset: z.string().optional(),
  limit: z.string().optional(),
});

export const sessionsRoutes = new Elysia({ prefix: "/sessions" })
  .get("/", ({ query }) => {
    const parsed = sessionListQuerySchema.parse(query);
    return listSessions(parsed.platform, {
      offset: parsed.offset ? Number(parsed.offset) : undefined,
      limit: parsed.limit ? Number(parsed.limit) : undefined,
    });
  })
  .get("/all", () => listSessions(undefined, { offset: 0, limit: 10_000 }))
  .post("/", ({ body }) => createSession(createSessionBodySchema.parse(body ?? {})))
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
  .get("/:sessionId", ({ params }) => getSessionInfo(params.sessionId))
  .get("/:sessionId/acp-dock", ({ params }) => fetchSessionAcpDock(params.sessionId))
  .get("/:sessionId/events", ({ params, request }) =>
    sseResponse(iterateSessionEvents(params.sessionId, request.signal), request.signal),
  )
  .get(
    "/:sessionId/messages",
    ({ params, query }) =>
      getSessionMessages(params.sessionId, {
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
    "/:sessionId/title",
    ({ params, body }) =>
      setSessionTitle(params.sessionId, {
        title: z
          .object({ title: z.string().min(1) })
          .parse(body)
          .title.trim(),
      }),
    {
      body: z.object({ title: z.string().min(1) }),
    },
  );
