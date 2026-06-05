import { z } from "zod";
import { studioConfigPatchSchema, studioSearchBodySchema } from "../../api/schemas.ts";
import {
  studioGetConfig,
  studioGetFile,
  studioGetTree,
  studioPatchConfig,
  studioSearch,
} from "../../handlers/index.ts";
import { publicProcedure, router } from "../trpc.ts";
import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalSession,
  streamTerminalEvents,
} from "../terminal-session.ts";

export const terminalEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), sessionId: z.string() }),
  z.object({ type: z.literal("output"), data: z.string() }),
  z.object({ type: z.literal("exit"), code: z.number() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export const studioRouter = router({
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
});
