import type { ServerWebSocket } from "bun";
import type { SapServerDeps } from "./ws-server.ts";
import { attachSapWebSocket } from "./ws-server.ts";
import { shouldBypassRemoteAuth } from "../../admin-api/remote-auth.ts";

type SapSocketData = {
  handler: ReturnType<typeof attachSapWebSocket>;
  bypassRemoteAuth: boolean;
};

export function createSapBunHandlers(deps: SapServerDeps): {
  fetch: (req: Request, server: Bun.Server<SapSocketData>) => Response | undefined;
  websocket: {
    open: (ws: ServerWebSocket<SapSocketData>) => void;
    message: (ws: ServerWebSocket<SapSocketData>, message: string | Buffer) => void;
    close: (ws: ServerWebSocket<SapSocketData>) => void;
  };
} {
  return {
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname !== "/sap/v1") {
        return undefined;
      }
      const remoteAddress =
        typeof server.requestIP === "function"
          ? (server.requestIP(req)?.address ?? undefined)
          : undefined;
      if (
        server.upgrade(req, {
          data: {
            handler: null as unknown as SapSocketData["handler"],
            bypassRemoteAuth: shouldBypassRemoteAuth(req, remoteAddress),
          },
        })
      ) {
        return undefined;
      }
      return new Response("Expected WebSocket upgrade", { status: 426 });
    },
    websocket: {
      open(ws) {
        ws.data.handler = attachSapWebSocket(
          deps,
          {
            send(data) {
              ws.send(data);
            },
            close(code, reason) {
              ws.close(code, reason);
            },
          },
          { bypassRemoteAuth: ws.data.bypassRemoteAuth },
        );
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
