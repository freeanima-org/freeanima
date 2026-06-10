import { Elysia } from "elysia";
import { z } from "zod";
import { studioConfigPatchSchema, studioSearchBodySchema } from "../../api/schemas.ts";
import {
  studioGetConfig,
  studioGetFile,
  studioGetTree,
  studioPatchConfig,
  studioSearch,
} from "../../handlers/index.ts";
import {
  closeTerminalSession,
  getTerminalSession,
  TerminalSessionError,
} from "../terminal-session.ts";

export const studioRoutes = new Elysia({ prefix: "/studio" })
  .get("/config", () => studioGetConfig())
  .patch("/config", ({ body }) => studioPatchConfig(studioConfigPatchSchema.parse(body)))
  .get("/tree", () => studioGetTree())
  .get("/file", ({ query }) => studioGetFile(z.object({ path: z.string() }).parse(query).path), {
    query: z.object({ path: z.string() }),
  })
  .post("/search", ({ body }) => studioSearch(studioSearchBodySchema.parse(body)))
  .post(
    "/terminal/:sessionId/write",
    ({ params, body }) => {
      const pty = getTerminalSession(params.sessionId);
      if (!pty) throw new TerminalSessionError();
      pty.write(z.object({ data: z.string() }).parse(body).data);
      return { ok: true as const };
    },
    { body: z.object({ data: z.string() }) },
  )
  .post(
    "/terminal/:sessionId/resize",
    ({ params, body }) => {
      const pty = getTerminalSession(params.sessionId);
      if (!pty) throw new TerminalSessionError();
      const { cols, rows } = z.object({ cols: z.number(), rows: z.number() }).parse(body);
      pty.resize(cols, rows);
      return { ok: true as const };
    },
    { body: z.object({ cols: z.number(), rows: z.number() }) },
  )
  .post("/terminal/:sessionId/close", ({ params }) => {
    closeTerminalSession(params.sessionId);
    return { ok: true as const };
  });
