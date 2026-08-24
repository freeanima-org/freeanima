import type { ServerWebSocket } from "bun";
import { HABITAT_RPC_REST_PREFIX } from "@freeanima/shared/habitat-rpc/urls.ts";
import type { RemoteToolsServerDeps } from "./ws-server.ts";
import { attachSapWebSocket } from "./ws-server.ts";
import { handleHttpHabitatRestRequestWithAuth } from "@freeanima/habitat/platform/habitat/http-rpc.ts";
import {
  attachFederationHubWebSocket,
  FEDERATION_WS_PATH,
  getFederationHubWsDeps,
} from "@freeanima/habitat/capabilities/federation";

type HabitatSocketData =
  | { kind: "sap"; handler: ReturnType<typeof attachSapWebSocket> | null }
  | { kind: "federation"; handler: ReturnType<typeof attachFederationHubWebSocket> | null };

function isWebSocketUpgrade(req: Request): boolean {
  return (req.headers.get("Upgrade") ?? "").toLowerCase() === "websocket";
}

function isRpcRoot(pathname: string): boolean {
  return pathname === HABITAT_RPC_REST_PREFIX;
}

function isRpcTree(pathname: string): boolean {
  return pathname.startsWith(`${HABITAT_RPC_REST_PREFIX}/`) || isRpcRoot(pathname);
}

function isFederationConnectPath(pathname: string): boolean {
  return pathname === FEDERATION_WS_PATH;
}

export function createSapBunHandlers(deps: RemoteToolsServerDeps): {
  fetch: (
    req: Request,
    server: Bun.Server<HabitatSocketData>,
  ) => Response | Promise<Response> | undefined;
  websocket: {
    open: (ws: ServerWebSocket<HabitatSocketData>) => void;
    message: (ws: ServerWebSocket<HabitatSocketData>, message: string | Buffer) => void;
    close: (ws: ServerWebSocket<HabitatSocketData>) => void;
  };
} {
  return {
    fetch(req, server) {
      const url = new URL(req.url);

      if (isFederationConnectPath(url.pathname)) {
        if (!isWebSocketUpgrade(req)) {
          return new Response("Expected WebSocket upgrade", { status: 426 });
        }
        const hubDeps = getFederationHubWsDeps();
        if (!hubDeps) {
          return new Response("Federation hub not ready", { status: 503 });
        }
        if (
          server.upgrade(req, {
            data: { kind: "federation", handler: null },
          })
        ) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      if (!isRpcTree(url.pathname)) {
        return undefined;
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
            data: { kind: "sap", handler: null },
          })
        ) {
          return undefined;
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
        if (ws.data.kind === "federation") {
          const hubDeps = getFederationHubWsDeps();
          if (!hubDeps) {
            ws.close(1011, "federation hub not ready");
            return;
          }
          ws.data.handler = attachFederationHubWebSocket(hubDeps, {
            send(data) {
              ws.send(data);
            },
            close(code, reason) {
              ws.close(code, reason);
            },
          });
          return;
        }
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
        void ws.data.handler?.handleMessage(message);
      },
      close(ws) {
        ws.data.handler?.close();
      },
    },
  };
}
