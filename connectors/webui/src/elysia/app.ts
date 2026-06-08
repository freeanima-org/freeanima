import { Elysia, NotFoundError } from "elysia";
import { WEBUI_BASE_PATH } from "../api/constants.ts";
import { ApiHandlerError } from "../handlers/errors.ts";
import { assertNotShuttingDown } from "./context.ts";
import { acpRoutes } from "./routes/acp.ts";
import { healthRoutes } from "./routes/health.ts";
import { mcpRoutes } from "./routes/mcp.ts";
import { memoryRoutes } from "./routes/memory.ts";
import { messagesRoutes } from "./routes/messages.ts";
import { sessionsRoutes } from "./routes/sessions.ts";
import { statusRoutes } from "./routes/status.ts";
import { studioRoutes } from "./routes/studio.ts";
import { terminalWsRoutes } from "./routes/terminal-ws.ts";

/** API 路由（Eden Treaty 类型真源） */
export const apiApp = new Elysia({ prefix: "/api" })
  .use(healthRoutes)
  .use(sessionsRoutes)
  .use(messagesRoutes)
  .use(statusRoutes)
  .use(memoryRoutes)
  .use(mcpRoutes)
  .use(acpRoutes)
  .use(studioRoutes)
  .use(terminalWsRoutes);

export type App = typeof apiApp;

const WEBUI_CHAT_PATH = `${WEBUI_BASE_PATH}/parlor/chat`;

/** 仅 API + 根重定向；SPA 由 Bun.serve routes 提供（见 webui-server.ts） */
export function createApiApp() {
  return new Elysia()
    .onBeforeHandle(({ path }) => {
      if (path.startsWith("/api")) assertNotShuttingDown();
    })
    .onError(({ error, set }) => {
      if (error instanceof ApiHandlerError) {
        set.status = error.status;
        return { error: error.message };
      }
      if (error instanceof Error && error.message.includes("终端会话")) {
        set.status = 404;
        return { error: error.message };
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
