import { EventEmitter } from "node:events";
import { getWSConnectionHandler, type CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import type { IncomingMessage } from "node:http";
import type { ServerWebSocket } from "bun";
import type { appRouter } from "./trpc/router.ts";
import { createTrpcContext } from "./trpc/context.ts";

const WEBSOCKET_OPEN = 1;

export type TrpcWsSocketData = {
  req: Request;
  client?: BunWsTrpcClient;
};

class BunWsTrpcClient extends EventEmitter {
  readyState = WEBSOCKET_OPEN;

  constructor(private readonly ws: ServerWebSocket<TrpcWsSocketData>) {
    super();
  }

  send(data: string | Buffer): void {
    this.ws.send(data);
  }

  close(): void {
    this.readyState = 3;
    this.ws.close();
  }

  terminate(): void {
    this.readyState = 3;
    this.ws.close(1012, "terminated");
  }
}

type AppRouter = typeof appRouter;

export type TrpcBunWsBridge = {
  open: (ws: ServerWebSocket<TrpcWsSocketData>) => void;
  message: (ws: ServerWebSocket<TrpcWsSocketData>, message: string | Buffer) => void;
  close: (ws: ServerWebSocket<TrpcWsSocketData>) => void;
  broadcastReconnectNotification: () => void;
};

export function createTrpcBunWsBridge(router: AppRouter): TrpcBunWsBridge {
  const clients = new Set<BunWsTrpcClient>();
  const onConnection = getWSConnectionHandler({
    router,
    createContext: (opts: CreateWSSContextFnOptions) => createTrpcContext(opts),
    keepAlive: { enabled: true, pingMs: 30_000, pongWaitMs: 5_000 },
    // getWSConnectionHandler 运行时不需要 wss；类型与 applyWSSHandler 共用
    wss: undefined,
  } as Parameters<typeof getWSConnectionHandler>[0]);

  return {
    open(ws) {
      const client = new BunWsTrpcClient(ws);
      ws.data.client = client;
      clients.add(client);
      const url = new URL(ws.data.req.url);
      const fakeReq = { url: `${url.pathname}${url.search}` };
      onConnection(client, fakeReq as IncomingMessage);
    },
    message(ws, message) {
      ws.data.client?.emit("message", message);
    },
    close(ws) {
      const client = ws.data.client;
      if (!client) return;
      client.emit("close");
      clients.delete(client);
    },
    broadcastReconnectNotification() {
      const data = JSON.stringify({ id: null, method: "reconnect" });
      for (const client of clients) {
        if (client.readyState === WEBSOCKET_OPEN) client.send(data);
      }
    },
  };
}
