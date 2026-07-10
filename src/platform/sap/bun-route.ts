import type { ServerWebSocket } from "bun";
import type { SapServerDeps } from "./ws-server.ts";
import { attachSapWebSocket } from "./ws-server.ts";
import { handleHttpHubRestRequestWithAuth } from "../hub/http-rpc.ts";

type SapSocketData = {
  handler: ReturnType<typeof attachSapWebSocket>;
};

function isWebSocketUpgrade(req: Request): boolean {
  return (req.headers.get("Upgrade") ?? "").toLowerCase() === "websocket";
}

export function createSapBunHandlers(deps: SapServerDeps): {
  fetch: (
    req: Request,
    server: Bun.Server<SapSocketData>,
  ) => Response | Promise<Response> | undefined;
  websocket: {
    open: (ws: ServerWebSocket<SapSocketData>) => void;
    message: (ws: ServerWebSocket<SapSocketData>, message: string | Buffer) => void;
    close: (ws: ServerWebSocket<SapSocketData>) => void;
  };
} {
  return {
    fetch(req, server) {
      const url = new URL(req.url);
      if (!url.pathname.startsWith("/hub/rpc/v1")) {
        return;
      }

      if (url.pathname === "/hub/rpc/v1") {
        if (req.method === "POST") {
          return new Response("Hub RPC envelope POST is no longer supported; use REST paths", {
            status: 410,
          });
        }
        if (
          isWebSocketUpgrade(req) &&
          server.upgrade(req, {
            data: {
              handler: null as unknown as SapSocketData["handler"],
            },
          })
        ) {
          return;
        }
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      if (req.method === "GET" || req.method === "POST") {
        return handleHttpHubRestRequestWithAuth(req, deps);
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
