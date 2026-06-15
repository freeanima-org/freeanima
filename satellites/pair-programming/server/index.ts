import { existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { getStudioConfig, buildFileTree, readStudioFile, searchStudio } from "./studio.ts";
import { connectSap } from "./sap/run.ts";
import { corsPreflight, jsonResponse, withCors } from "./http/cors.ts";
import { handleHubApi } from "./http/hub-api.ts";
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

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function route(req: Request, server: Bun.Server<TerminalWsData>): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return corsPreflight();
  }

  if (url.pathname === "/api/studio/terminal/ws") {
    if (server.upgrade(req, { data: { terminalId: "", cleanups: [] } })) {
      return new Response(null, { status: 101 });
    }
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  }

  if (url.pathname === "/api/meta" && req.method === "GET") {
    return jsonResponse({ app: "pair-programming" });
  }

  const hubApi = await handleHubApi(req, url);
  if (hubApi) return hubApi;

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
    const sessionId = decodeURIComponent(termWrite[1] ?? "");
    const body = (await req.json()) as { data?: string };
    await terminalWrite(sessionId, body.data ?? "");
    return jsonResponse({ ok: true });
  }
  const termResize = /^\/api\/studio\/terminal\/([^/]+)\/resize$/.exec(url.pathname);
  if (termResize && req.method === "POST") {
    const sessionId = decodeURIComponent(termResize[1] ?? "");
    const body = (await req.json()) as { cols?: number; rows?: number };
    await terminalResize(sessionId, body.cols ?? 80, body.rows ?? 24);
    return jsonResponse({ ok: true });
  }
  const termClose = /^\/api\/studio\/terminal\/([^/]+)\/close$/.exec(url.pathname);
  if (termClose && req.method === "POST") {
    const sessionId = decodeURIComponent(termClose[1] ?? "");
    await terminalClose(sessionId);
    return jsonResponse({ ok: true });
  }

  return serveStatic(url.pathname);
}

function serveStatic(pathname: string): Response {
  if (!existsSync(DIST_DIR)) {
    return jsonResponse(
      { error: "UI not built; run `bun satellites/pair-programming/dev.ts` or `bun build.ts`" },
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

const server = Bun.serve<TerminalWsData>({
  port: PORT,
  fetch(req, srv) {
    return route(req, srv);
  },
  websocket: {
    open(ws) {
      void handleTerminalWsOpen(ws);
    },
    message() {
      /* terminal input via HTTP write */
    },
    close(ws) {
      handleTerminalWsClose(ws);
    },
  },
});

console.log(`pair-programming satellite ${HTTP_URL}`);

void connectSap(HUB_URL, HTTP_URL).catch((e) => {
  console.warn("SAP connect deferred:", e.message);
});

export { server, HTTP_URL };
