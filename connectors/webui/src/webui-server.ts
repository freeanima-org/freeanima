import { WEBUI_BASE_PATH } from "./api/constants.ts";
import webuiHtml from "../app/index.html";
import { createHttpRoutes, TRPC_WS_PATH } from "./http-routes.ts";
import type { TrpcWsSocketData } from "./trpc-bun-ws.ts";

export type WebuiServerOptions = {
  development?: boolean;
};

export type WebuiServerHandle = {
  close: () => void | Promise<void>;
};

export async function startWebuiHttpServer(
  host: string,
  port: number,
  options: WebuiServerOptions = {},
): Promise<WebuiServerHandle> {
  const development = options.development ?? process.env.NODE_ENV !== "production";
  if (development) {
    process.env.NODE_ENV = "development";
  }

  const routes = createHttpRoutes();

  const server = Bun.serve<TrpcWsSocketData>({
    hostname: host,
    port,
    development: development ? { console: true } : false,
    routes: {
      [WEBUI_BASE_PATH]: webuiHtml,
      [`${WEBUI_BASE_PATH}/*`]: webuiHtml,
    },
    async fetch(req, bunServer) {
      const url = new URL(req.url);
      if (
        url.pathname === TRPC_WS_PATH &&
        req.headers.get("upgrade")?.toLowerCase() === "websocket"
      ) {
        if (bunServer.upgrade(req, { data: { req } })) {
          return undefined as unknown as Response;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      return routes.fetch(req);
    },
    websocket: {
      open(ws) {
        routes.websocket.open(ws);
      },
      message(ws, message) {
        routes.websocket.message(ws, message);
      },
      close(ws) {
        routes.websocket.close(ws);
      },
    },
  });

  if (!server.port) {
    throw new Error(`WebUI server failed to bind ${host}:${port}`);
  }

  return {
    close: () => {
      routes.broadcastReconnectNotification();
      routes.shutdown();
      server.stop(true);
    },
  };
}

export async function startWebuiHttpServers(
  hosts: string[],
  port: number,
  options: WebuiServerOptions = {},
): Promise<WebuiServerHandle[]> {
  if (hosts.length === 1) {
    return [await startWebuiHttpServer(hosts[0]!, port, options)];
  }
  return Promise.all(hosts.map((host) => startWebuiHttpServer(host, port, options)));
}

export { WEBUI_BASE_PATH } from "./api/constants.ts";
