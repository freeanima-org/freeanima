import { Elysia, NotFoundError } from "elysia";
import { ApiHandlerError, apiErrorBody } from "../handlers/errors.ts";
import { assertNotShuttingDown } from "./context.ts";
import { applyCorsHeaders, corsPreflightResponse } from "./cors.ts";
import { ttsRoutes } from "./routes/tts.ts";
import { companionHttpRoutes } from "@freeanima/features/companion/hub/http";
import { TerminalSessionError } from "@freeanima/platform/sap/terminal-session";

/** 基础设施 HTTP：TTS / companion 资产（health/TLS 已迁 Hub RPC public methods） */
export const apiApp = new Elysia({ prefix: "/api" }).use(ttsRoutes).use(companionHttpRoutes);

export type App = typeof apiApp;

/** Hub HTTP：TTS / companion；业务 API 走 Hub RPC REST/WS */
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
      return;
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
        const terminalError = error;
        set.status = 404;
        return { error: terminalError.message, code: terminalError.code };
      }
      if (error instanceof NotFoundError) {
        set.status = 404;
        return { error: "NOT_FOUND" };
      }
      set.status = 500;
      return { error: error instanceof Error ? error.message : "Internal Server Error" };
    })
    .use(apiApp);
}
