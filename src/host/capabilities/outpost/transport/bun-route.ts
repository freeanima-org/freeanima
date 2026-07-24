import type { ServerWebSocket } from "bun";
import { HABITAT_RPC_REST_PREFIX } from "@freeanima/shared/habitat-rpc/urls.ts";
import type { RemoteToolsServerDeps } from "./ws-server.ts";
import { attachSapWebSocket } from "./ws-server.ts";
import { handleHttpHabitatRestRequestWithAuth } from "@freeanima/host/platform/habitat/http-rpc.ts";

type RemoteToolsSocketData = {
  handler: ReturnType<typeof attachSapWebSocket>;
};

function isWebSocketUpgrade(req: Request): boolean {
  return (req.headers.get("Upgrade") ?? "").toLowerCase() === "websocket";
}

function isRpcRoot(pathname: string): boolean {
  return pathname === HABITAT_RPC_REST_PREFIX;
}

function isRpcTree(pathname: string): boolean {
  return pathname.startsWith(`${HABITAT_RPC_REST_PREFIX}/`) || isRpcRoot(pathname);
}

export function createSapBunHandlers(deps: RemoteToolsServerDeps): {
  fetch: (
    req: Request,
    server: Bun.Server<RemoteToolsSocketData>,
  ) => Response | Promise<Response> | undefined;
  websocket: {
    open: (ws: ServerWebSocket<RemoteToolsSocketData>) => void;
    message: (ws: ServerWebSocket<RemoteToolsSocketData>, message: string | Buffer) => void;
    close: (ws: ServerWebSocket<RemoteToolsSocketData>) => void;
  };
} {
  return {
    fetch(req, server) {
      const url = new URL(req.url);
      if (!isRpcTree(url.pathname)) {
        return;
      }

      if (isRpcRoot(url.pathname)) {
        if (req.method === "POST") {
          return new Response("Habitat RPC envelope POST is no longer supported; use REST paths", {
            status: 410,
          });
        }
        if (
          isWebSocketUpgrade(req) &&
          server.upgrade(req, {
            data: {
              handler: null as unknown as RemoteToolsSocketData["handler"],
            },
          })
        ) {
          return;
        }
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      if (req.method === "GET" || req.method === "POST") {
        return handleHttpHabitatRestRequestWithAuth(req, deps);
      }

      return new Response("Method Not Allowed", { status: 405 });
    },
    websocket: {
      open(ws) {
        ws.data.handler = attachSapWebSocket(deps, {
          send(data) {
            ws.send(data);
          },
          close(code, reason) {
            ws.close(code, reason);
          },
        });
      },
      message(ws, message) {
        if (typeof message !== "string") return;
        void ws.data.handler.handleMessage(message);
      },
      close(ws) {
        ws.data.handler.close();
      },
    },
  };
}
