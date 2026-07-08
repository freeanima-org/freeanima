import type { ServerWebSocket } from "bun";
import type { SapServerDeps } from "./ws-server.ts";
import { attachSapWebSocket } from "./ws-server.ts";
import { handleHttpHubRpcRequest } from "../hub/http-rpc.ts";

type SapSocketData = {
  handler: ReturnType<typeof attachSapWebSocket>;
};

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
      if (url.pathname !== "/hub/rpc/v1") {
        return;
      }
      if (req.method === "POST") {
        return handleHttpHubRpcRequest(req, deps);
      }
      if (
        server.upgrade(req, {
          data: {
            handler: null as unknown as SapSocketData["handler"],
          },
        })
      ) {
        return;
      }
      return new Response("Expected WebSocket upgrade or POST", { status: 426 });
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
