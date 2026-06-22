import { existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import type { ServerWebSocket } from "bun";

import {
  handleRelayWsClose,
  handleRelayWsMessage,
  handleRelayWsOpen,
  type RelayWsData,
} from "@freeanima/sap-contract";
import { connectSap } from "./sap/run.ts";
import { getSapClient, getSapInstanceId, getRelayState } from "./sap/hub.ts";

const PORT = Number(process.env.SATELLITE_PORT ?? 4174);
const DIST_DIR = join(import.meta.dir, "..", "dist");
const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const APP_ID = "parlor";
const HTTP_URL = `http://127.0.0.1:${PORT}`;

type ServerWsData = { channel: "relay" } & RelayWsData;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function hubUrl(): string {
  return HUB_URL;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function route(req: Request, server: Bun.Server<ServerWsData>): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/sap/relay/v1") {
    if (server.upgrade(req, { data: { channel: "relay", cleanups: [] } })) {
      return new Response(null, { status: 101 });
    }
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  }

  if (url.pathname === "/config.json" && req.method === "GET") {
    return jsonResponse({
      app_id: APP_ID,
      instance_id: getSapInstanceId(),
      relay_ws_url: `${HTTP_URL.replace(/^http/, "ws")}/sap/relay/v1`,
    });
  }

  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, app: APP_ID, instance_id: getSapInstanceId() || null });
  }

  return serveStatic(url.pathname);
}

function serveStatic(pathname: string): Response {
  if (!existsSync(DIST_DIR)) {
    return jsonResponse(
      { error: "UI not built; run `bun satellites/parlor/dev.ts` or `bun build.ts`" },
      503,
    );
  }

  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(DIST_DIR, rel);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    const headers = MIME[ext] ? { "Content-Type": MIME[ext]! } : undefined;
    return new Response(Bun.file(filePath), { headers });
  }

  if (pathname.endsWith(".js")) {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  const indexPath = join(DIST_DIR, "index.html");
  if (existsSync(indexPath)) {
    return new Response(Bun.file(indexPath), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return jsonResponse({ error: "Not Found" }, 404);
}

const server = Bun.serve<ServerWsData>({
  port: PORT,
  fetch(req, srv) {
    return route(req, srv);
  },
  websocket: {
    open(ws) {
      const relayState = getRelayState();
      if (relayState) {
        handleRelayWsOpen(relayState, ws as ServerWebSocket<RelayWsData & { channel: "relay" }>);
      }
    },
    message(ws, message) {
      void handleRelayWsMessage(
        ws as ServerWebSocket<RelayWsData & { channel: "relay" }>,
        String(message),
        () => getSapClient(hubUrl(), HTTP_URL),
      );
    },
    close(ws) {
      const relayState = getRelayState();
      if (relayState) {
        handleRelayWsClose(relayState, ws as ServerWebSocket<RelayWsData & { channel: "relay" }>);
      }
    },
  },
});

console.log(`parlor satellite ${HTTP_URL}`);

void connectSap(HUB_URL, HTTP_URL);

export { server, HTTP_URL };
