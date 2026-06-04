import { z } from "zod";
import {
  createSessionBodySchema,
  memorySearchBodySchema,
  streamApiEventSchema,
  studioConfigPatchSchema,
  studioSearchBodySchema,
} from "@freeanima/legacy-api";
import {
  acpStartAgent,
  acpStartAll,
  acpStopAgent,
  acpStopAll,
  createSession,
  getAcpStatus,
  getConfig,
  getHealth,
  getMcpStatus,
  getPlatforms,
  getSessionInfo,
  getSessionMessages,
  getStatus,
  iterateMessageStream,
  listCommands,
  listCronJobs,
  listMemoryFiles,
  listSessions,
  listTools,
  mcpStartAll,
  mcpStartServer,
  mcpStopAll,
  mcpStopServer,
  memoryL2Distill,
  memoryL2Rebuild,
  memoryL2Reindex,
  memoryL3Reindex,
  memorySearch,
  pauseCronJob,
  restartService,
  resumeCronJob,
  runCronJobNow,
  setSessionTitle,
  studioGetConfig,
  studioGetFile,
  studioGetTree,
  studioPatchConfig,
  studioSearch,
} from "../handlers";
import { publicProcedure, router } from "./trpc";
import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalSession,
  streamTerminalEvents,
} from "./terminal-session";

const terminalEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), sessionId: z.string() }),
  z.object({ type: z.literal("output"), data: z.string() }),
  z.object({ type: z.literal("exit"), code: z.number() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export const appRouter = router({
  health: router({
    check: publicProcedure.query(() => getHealth()),
  }),

  sessions: router({
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
        listCommands({ all: input?.all, platform: input?.platform ?? "parlor" }),
      ),
  }),

  messages: router({
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
  }),

  status: router({
    get: publicProcedure.query(() => getStatus()),
    config: publicProcedure.query(() => getConfig()),
    tools: publicProcedure.query(() => listTools()),
    platforms: publicProcedure.query(() => getPlatforms()),
    cronJobs: publicProcedure.query(() => listCronJobs()),
    pauseCron: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => pauseCronJob(input.id)),
    resumeCron: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => resumeCronJob(input.id)),
    runCron: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => runCronJobNow(input.id)),
    restart: publicProcedure.mutation(() => restartService()),
  }),

  memory: router({
    files: publicProcedure.query(() => listMemoryFiles()),
    search: publicProcedure
      .input(memorySearchBodySchema)
      .mutation(({ input }) => memorySearch(input)),
    l2Distill: publicProcedure.mutation(() => memoryL2Distill()),
    l2Reindex: publicProcedure.mutation(() => memoryL2Reindex()),
    l3Reindex: publicProcedure.mutation(() => memoryL3Reindex()),
    l2Rebuild: publicProcedure.mutation(() => memoryL2Rebuild()),
  }),

  mcp: router({
    status: publicProcedure.query(() => getMcpStatus()),
    startAll: publicProcedure.mutation(() => mcpStartAll()),
    stopAll: publicProcedure.mutation(() => mcpStopAll()),
    start: publicProcedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => mcpStartServer(input.name)),
    stop: publicProcedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => mcpStopServer(input.name)),
  }),

  acp: router({
    status: publicProcedure.query(() => getAcpStatus()),
    startAll: publicProcedure.mutation(() => acpStartAll()),
    stopAll: publicProcedure.mutation(() => acpStopAll()),
    start: publicProcedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => acpStartAgent(input.name)),
    stop: publicProcedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => acpStopAgent(input.name)),
  }),

  studio: router({
    config: router({
      get: publicProcedure.query(() => studioGetConfig()),
      patch: publicProcedure
        .input(studioConfigPatchSchema)
        .mutation(({ input }) => studioPatchConfig(input)),
    }),
    tree: publicProcedure.query(() => studioGetTree()),
    file: publicProcedure
      .input(z.object({ path: z.string() }))
      .query(({ input }) => studioGetFile(input.path)),
    search: publicProcedure
      .input(studioSearchBodySchema)
      .mutation(({ input }) => studioSearch(input)),

    terminal: router({
      stream: publicProcedure.subscription(async function* ({ signal }) {
        let sessionId: string;
        let pty;
        try {
          ({ sessionId, pty } = createTerminalSession());
        } catch (e) {
          yield { type: "error" as const, message: String(e) };
          return;
        }

        yield* streamTerminalEvents(sessionId, pty, signal);
      }),
      write: publicProcedure
        .input(z.object({ sessionId: z.string(), data: z.string() }))
        .mutation(({ input }) => {
          const pty = getTerminalSession(input.sessionId);
          if (!pty) {
            throw new Error("终端会话不存在或已关闭");
          }
          pty.write(input.data);
          return { ok: true as const };
        }),
      resize: publicProcedure
        .input(
          z.object({
            sessionId: z.string(),
            cols: z.number(),
            rows: z.number(),
          }),
        )
        .mutation(({ input }) => {
          const pty = getTerminalSession(input.sessionId);
          if (!pty) {
            throw new Error("终端会话不存在或已关闭");
          }
          pty.resize(input.cols, input.rows);
          return { ok: true as const };
        }),
      close: publicProcedure.input(z.object({ sessionId: z.string() })).mutation(({ input }) => {
        closeTerminalSession(input.sessionId);
        return { ok: true as const };
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;

export { terminalEventSchema };
