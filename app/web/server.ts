import { existsSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { resolveHubWsUrl } from "@freeanima/sap-contract";

const PORT = Number(process.env.WEB_DEV_PORT ?? process.env.SHELL_DEV_PORT ?? 4173);
const DIST_DIR = join(import.meta.dir, "dist");
const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const APP_ID = "chat";
const HTTP_URL = `http://127.0.0.1:${PORT}`;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function staticRelPath(pathname: string): string {
  return pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
}

function resolveDistFile(pathname: string): string | null {
  const filePath = join(DIST_DIR, staticRelPath(pathname));
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return filePath;
  }
  return null;
}

function fileResponse(filePath: string, method: string): Response {
  const ext = extname(filePath);
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    ...(MIME[ext] ? { "Content-Type": MIME[ext]! } : {}),
  };
  const body = method === "HEAD" ? null : readFileSync(filePath);
  return new Response(body, { headers });
}

function serveStatic(pathname: string, method: string): Response {
  if (!existsSync(DIST_DIR)) {
    return jsonResponse(
      { error: "UI not built; run `bun run dev:web` or `bun app/web/build.ts`" },
      503,
    );
  }

  const filePath = resolveDistFile(pathname);
  if (filePath) {
    return fileResponse(filePath, method);
  }

  if (pathname.endsWith(".js") || pathname.endsWith(".css") || pathname.endsWith(".map")) {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  const indexPath = resolveDistFile("/index.html");
  if (indexPath) {
    return fileResponse(indexPath, method);
  }

  return jsonResponse({ error: "Not Found" }, 404);
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/config.json" && req.method === "GET") {
    return jsonResponse({
      app_id: APP_ID,
      hub_ws_url: resolveHubWsUrl(HUB_URL),
    });
  }

  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, app: APP_ID, mode: "web-dev" });
  }

  return serveStatic(url.pathname, req.method);
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  fetch(req) {
    return route(req);
  },
});

console.log(`[dev:web] ${HTTP_URL}/chat (hub ${HUB_URL})`);

export { server, HTTP_URL };
