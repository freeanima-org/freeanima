import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { WEBUI_BASE_PATH } from "./api/constants.ts";
import { getHealth } from "./handlers/index.ts";
import { createTrpcContext } from "./trpc/context.ts";
import { appRouter } from "./trpc/router.ts";
import { closeAllTerminalSessions } from "./trpc/terminal-session.ts";
import { createTrpcBunWsBridge, type TrpcBunWsBridge } from "./trpc-bun-ws.ts";

export const TRPC_HTTP_PATH = "/api/trpc";
export const TRPC_WS_PATH = "/api/trpc/ws";
export const HEALTH_PATH = "/api/health";

const WEBUI_CHAT_PATH = `${WEBUI_BASE_PATH}/parlor/chat`;

export type HttpRoutesHandle = {
  fetch: (req: Request) => Response | Promise<Response>;
  websocket: TrpcBunWsBridge;
  shutdown: () => void;
  broadcastReconnectNotification: () => void;
};

function redirectRoot(origin: string): Response {
  return Response.redirect(`${origin}${WEBUI_CHAT_PATH}`, 302);
}

async function handleTrpcFetch(req: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: TRPC_HTTP_PATH,
    req,
    router: appRouter,
    createContext: createTrpcContext,
  });
}

async function handleHealth(): Promise<Response> {
  const data = await getHealth();
  return Response.json(data);
}

/** 对外 HTTP：/api/*；/webui/* 由 Bun.serve routes 处理 */
export function createHttpRoutes(): HttpRoutesHandle {
  const websocket = createTrpcBunWsBridge(appRouter);

  const fetch = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "") {
      return redirectRoot(url.origin);
    }

    if (url.pathname === HEALTH_PATH) {
      return handleHealth();
    }

    if (url.pathname.startsWith(TRPC_HTTP_PATH)) {
      return handleTrpcFetch(req);
    }

    return new Response("Not Found", { status: 404 });
  };

  const shutdown = () => {
    closeAllTerminalSessions();
  };

  return {
    fetch,
    websocket,
    shutdown,
    broadcastReconnectNotification: websocket.broadcastReconnectNotification,
  };
}
