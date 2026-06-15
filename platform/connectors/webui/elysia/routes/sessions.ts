import { Elysia } from "elysia";
import { z } from "zod";
import { createSessionBodySchema } from "../../api/schemas.ts";
import { PARLOR_PLATFORM } from "../../api/constants.ts";
import {
  createSession,
  getSessionInfo,
  getSessionMessages,
  listCommands,
  listSessions,
  setSessionTitle,
} from "../../handlers/index.ts";
import { fetchSessionAcpDock } from "../../handlers/session-events.ts";

export const sessionsRoutes = new Elysia({ prefix: "/sessions" })
  .get("/", ({ query }) => listSessions(query.platform))
  .get("/all", () => listSessions(""))
  .post("/", ({ body }) => createSession(createSessionBodySchema.parse(body ?? {})))
  .get(
    "/commands",
    ({ query }) =>
      listCommands({
        all: query.all === "true" || query.all === true,
        platform: typeof query.platform === "string" ? query.platform : PARLOR_PLATFORM,
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
