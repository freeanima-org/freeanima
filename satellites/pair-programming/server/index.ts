import { existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import type { ServerWebSocket } from "bun";
import { getStudioConfig, buildFileTree, readStudioFile, searchStudio } from "./studio.ts";
import { connectSap } from "./sap/run.ts";
import { getSapClient, getSapInstanceId, getRelayState } from "./sap/hub.ts";
import { corsPreflight, jsonResponse, withCors } from "./http/cors.ts";
import {
  handleRelayWsClose,
  handleRelayWsMessage,
  handleRelayWsOpen,
  type RelayWsData,
} from "@freeanima/sap-contract";
import {
  handleTerminalWsClose,
  handleTerminalWsOpen,
  terminalClose,
  terminalResize,
  terminalWrite,
  type TerminalWsData,
} from "./http/terminal-bridge.ts";

const PORT = Number(process.env.SATELLITE_PORT ?? 4173);
const DIST_DIR = join(import.meta.dir, "..", "dist");
const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const HTTP_URL = `http://127.0.0.1:${PORT}`;

type ServerWsData =
  | ({ channel: "relay" } & RelayWsData)
  | ({ channel: "terminal" } & TerminalWsData);

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

async function route(req: Request, server: Bun.Server<ServerWsData>): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return corsPreflight();
  }

  if (url.pathname === "/sap/relay/v1") {
    if (server.upgrade(req, { data: { channel: "relay", cleanups: [] } })) {
      return new Response(null, { status: 101 });
    }
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  }

  if (url.pathname === "/api/studio/terminal/ws") {
    if (server.upgrade(req, { data: { channel: "terminal", terminalId: "", cleanups: [] } })) {
      return new Response(null, { status: 101 });
    }
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  }

  if (url.pathname === "/config.json" && req.method === "GET") {
    return jsonResponse({
      app_id: "pair-programming",
      instance_id: getSapInstanceId(),
      relay_ws_url: `${HTTP_URL.replace(/^http/, "ws")}/sap/relay/v1`,
    });
  }

  if (url.pathname === "/api/meta" && req.method === "GET") {
    return jsonResponse({ app: "pair-programming" });
  }

  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, app: "pair-programming" });
  }
  if (url.pathname === "/api/studio/config" && req.method === "GET") {
    return jsonResponse(getStudioConfig());
  }
  if (url.pathname === "/api/studio/tree") {
    try {
      return jsonResponse(buildFileTree());
    } catch (e) {
      return jsonResponse({ error: String(e) }, 400);
    }
  }
  if (url.pathname === "/api/studio/file") {
    const path = url.searchParams.get("path") ?? "";
    try {
      return jsonResponse(readStudioFile(path));
    } catch (e) {
      return jsonResponse({ error: String(e) }, 400);
    }
  }
  if (url.pathname === "/api/studio/search" && req.method === "POST") {
    const body = await req.json();
    const query = String((body as { query?: string }).query ?? "");
    return jsonResponse(searchStudio(query));
  }

  const termWrite = /^\/api\/studio\/terminal\/([^/]+)\/write$/.exec(url.pathname);
  if (termWrite && req.method === "POST") {
    const conversationId = decodeURIComponent(termWrite[1] ?? "");
    const body = (await req.json()) as { data?: string };
    await terminalWrite(conversationId, body.data ?? "");
    return jsonResponse({ ok: true });
  }
  const termResize = /^\/api\/studio\/terminal\/([^/]+)\/resize$/.exec(url.pathname);
  if (termResize && req.method === "POST") {
    const conversationId = decodeURIComponent(termResize[1] ?? "");
    const body = (await req.json()) as { cols?: number; rows?: number };
    await terminalResize(conversationId, body.cols ?? 80, body.rows ?? 24);
    return jsonResponse({ ok: true });
  }
  const termClose = /^\/api\/studio\/terminal\/([^/]+)\/close$/.exec(url.pathname);
  if (termClose && req.method === "POST") {
    const conversationId = decodeURIComponent(termClose[1] ?? "");
    await terminalClose(conversationId);
    return jsonResponse({ ok: true });
  }

  if (process.env.SATELLITE_VITE_DEV === "1") {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  return serveStatic(url.pathname);
}

function serveStatic(pathname: string): Response {
  if (!existsSync(DIST_DIR)) {
    return jsonResponse(
      { error: "UI not built; run `bun run dev` (Vite) or `bun run build`" },
      503,
    );
  }

  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(DIST_DIR, rel);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    const headers = MIME[ext] ? { "Content-Type": MIME[ext]! } : undefined;
    return withCors(new Response(Bun.file(filePath), { headers }));
  }

  const indexPath = join(DIST_DIR, "index.html");
  if (existsSync(indexPath)) {
    return withCors(
      new Response(Bun.file(indexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );
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
      if (ws.data.channel === "terminal") {
        void handleTerminalWsOpen(ws as ServerWebSocket<TerminalWsData & { channel: "terminal" }>);
        return;
      }
      const relayState = getRelayState();
      if (relayState) {
        handleRelayWsOpen(relayState, ws as ServerWebSocket<RelayWsData & { channel: "relay" }>);
      }
    },
    message(ws, message) {
      if (ws.data.channel !== "relay") return;
      void handleRelayWsMessage(
        ws as ServerWebSocket<RelayWsData & { channel: "relay" }>,
        String(message),
        () => getSapClient(hubUrl(), HTTP_URL),
      );
    },
    close(ws) {
      if (ws.data.channel === "terminal") {
        handleTerminalWsClose(ws as ServerWebSocket<TerminalWsData & { channel: "terminal" }>);
        return;
      }
      const relayState = getRelayState();
      if (relayState) {
        handleRelayWsClose(relayState, ws as ServerWebSocket<RelayWsData & { channel: "relay" }>);
      }
    },
  },
});

console.log(`pair-programming satellite ${HTTP_URL}`);

void connectSap(HUB_URL, HTTP_URL);

export { server, HTTP_URL };
