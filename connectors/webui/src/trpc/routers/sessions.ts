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
import { publicProcedure, router } from "../trpc.ts";

export const sessionsRouter = router({
  list: publicProcedure
    .input(z.object({ platform: z.string().optional() }).optional())
    .query(({ input }) => listSessions(input?.platform)),
  listAll: publicProcedure.query(() => listSessions("")),
  create: publicProcedure
    .input(createSessionBodySchema.optional())
    .mutation(({ input }) => createSession(input ?? {})),
  info: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => getSessionInfo(input.sessionId)),
  messages: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      }),
    )
    .query(({ input }) =>
      getSessionMessages(input.sessionId, {
        offset: input.offset,
        limit: input.limit,
      }),
    ),
  setTitle: publicProcedure
    .input(z.object({ sessionId: z.string(), title: z.string().min(1) }))
    .mutation(({ input }) => setSessionTitle(input.sessionId, { title: input.title.trim() })),
  commands: publicProcedure
    .input(
      z
        .object({
          all: z.boolean().optional(),
          platform: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) =>
      listCommands({ all: input?.all, platform: input?.platform ?? PARLOR_PLATFORM }),
    ),
});
