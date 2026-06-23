import { existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { resolveHubWsUrl } from "@freeanima/sap-contract";

const PORT = Number(process.env.SATELLITE_PORT ?? 4174);
const DIST_DIR = join(import.meta.dir, "..", "dist");
const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const APP_ID = "chat";
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
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
    return jsonResponse({ ok: true, app: APP_ID, mode: "static" });
  }

  return serveStatic(url.pathname);
}

function serveStatic(pathname: string): Response {
  if (!existsSync(DIST_DIR)) {
    return jsonResponse(
      { error: "UI not built; run `bun satellites/chat/dev.ts` or `bun build.ts`" },
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

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    return route(req);
  },
});

console.log(`chat static UI ${HTTP_URL} (SAP direct; Hub ${HUB_URL})`);

export { server, HTTP_URL };
