import { Elysia, NotFoundError } from "elysia";
import { ApiHandlerError, apiErrorBody } from "../handlers/errors.ts";
import { assertNotShuttingDown } from "./context.ts";
import { applyCorsHeaders, corsPreflightResponse } from "./cors.ts";
import { acpRoutes } from "./routes/acp.ts";
import { credentialsRoutes } from "./routes/credentials.ts";
import { emailRoutes } from "./routes/email.ts";
import { ftsRoutes } from "./routes/fts.ts";
import { healthRoutes } from "./routes/health.ts";
import { echoRoutes } from "./routes/echo.ts";
import { mcpRoutes } from "./routes/mcp.ts";
import { satellitesRoutes } from "./routes/satellites.ts";
import { memoryRoutes } from "./routes/memory.ts";
import { promptRoutes } from "./routes/prompt.ts";
import { selfRoutes } from "./routes/self.ts";
import { conversationsRoutes } from "./routes/conversations.ts";
import { cronLogRoutes, sleepRoutes } from "./routes/sleep.ts";
import { statusRoutes } from "./routes/status.ts";
import { TerminalSessionError } from "./terminal-session.ts";
import { tasksRoutes } from "./routes/tasks.ts";
import { fridgeMagnetRoutes } from "./routes/fridge-magnet.ts";
import { autoLlmRunRoutes } from "./routes/auto-llm-runs.ts";

/** API 路由（Eden Treaty 类型真源） */
export const apiApp = new Elysia({ prefix: "/api" })
  .use(healthRoutes)
  .use(echoRoutes)
  .use(conversationsRoutes)
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

/** Hub HTTP：仅 REST API（UI 由 desktop / mobile 客户端 bundled 提供） */
export function createApiApp() {
  return new Elysia()
    .onBeforeHandle(({ path, request, set }) => {
      if (request.method === "OPTIONS" && path.startsWith("/api")) {
        const preflight = corsPreflightResponse(request.headers.get("Origin"));
        if (preflight) {
          set.status = 204;
          return preflight;
        }
      }
      if (path.startsWith("/api")) assertNotShuttingDown();
    })
    .onAfterHandle(({ request, set }) => {
      applyCorsHeaders(set.headers, request.headers.get("Origin"));
    })
    .onError(({ error, set, request }) => {
      applyCorsHeaders(set.headers, request.headers.get("Origin"));
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
    .get("/", () => ({ service: "freeanima", api: "/api" }))
    .use(apiApp);
}
