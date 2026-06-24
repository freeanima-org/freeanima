import { Elysia, NotFoundError } from "elysia";
import { WEBUI_BASE_PATH } from "../api/constants.ts";
import { ApiHandlerError, apiErrorBody } from "../handlers/errors.ts";
import { assertNotShuttingDown } from "./context.ts";
import { acpRoutes } from "./routes/acp.ts";
import { credentialsRoutes } from "./routes/credentials.ts";
import { emailRoutes } from "./routes/email.ts";
import { ftsRoutes } from "./routes/fts.ts";
import { healthRoutes } from "./routes/health.ts";
import { mcpRoutes } from "./routes/mcp.ts";
import { satellitesRoutes } from "./routes/satellites.ts";
import { memoryRoutes } from "./routes/memory.ts";
import { promptRoutes } from "./routes/prompt.ts";
import { selfRoutes } from "./routes/self.ts";
import { sessionsRoutes } from "./routes/sessions.ts";
import { cronLogRoutes, sleepRoutes } from "./routes/sleep.ts";
import { statusRoutes } from "./routes/status.ts";
import { TerminalSessionError } from "./terminal-session.ts";
import { tasksRoutes } from "./routes/tasks.ts";
import { fridgeMagnetRoutes } from "./routes/fridge-magnet.ts";
import { autoLlmRunRoutes } from "./routes/auto-llm-runs.ts";

/** API 路由（Eden Treaty 类型真源） */
export const apiApp = new Elysia({ prefix: "/api" })
  .use(healthRoutes)
  .use(sessionsRoutes)
  .use(statusRoutes)
  .use(sleepRoutes)
  .use(cronLogRoutes)
  .use(memoryRoutes)
  .use(ftsRoutes)
  .use(promptRoutes)
  .use(selfRoutes)
  .use(mcpRoutes)
  .use(satellitesRoutes)
  .use(acpRoutes)
  .use(credentialsRoutes)
  .use(emailRoutes)
  .use(tasksRoutes)
  .use(fridgeMagnetRoutes)
  .use(autoLlmRunRoutes);

export type App = typeof apiApp;

const WEBUI_CHAT_PATH = `${WEBUI_BASE_PATH}/chamber/dashboard`;

/** 仅 API + 根重定向；SPA 由 Bun.serve routes 提供（见 webui-server.ts） */
export function createApiApp() {
  return new Elysia()
    .onBeforeHandle(({ path }) => {
      if (path.startsWith("/api")) assertNotShuttingDown();
    })
    .onError(({ error, set }) => {
      if (error instanceof ApiHandlerError) {
        set.status = error.status;
        return apiErrorBody(error);
      }
      if (error instanceof TerminalSessionError) {
        set.status = 404;
        return { error: error.message, code: error.code };
      }
      if (error instanceof NotFoundError) {
        set.status = 404;
        return { error: "NOT_FOUND" };
      }
      set.status = 500;
      return { error: error instanceof Error ? error.message : "Internal Server Error" };
    })
    .get("/", ({ request }) => {
      const url = new URL(request.url);
      return Response.redirect(`${url.origin}${WEBUI_CHAT_PATH}`, 302);
    })
    .use(apiApp);
}

export { WEBUI_BASE_PATH, WEBUI_CHAT_PATH };
