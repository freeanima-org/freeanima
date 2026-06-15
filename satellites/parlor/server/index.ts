import { existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const PORT = Number(process.env.SATELLITE_PORT ?? 4174);
const DIST_DIR = join(import.meta.dir, "..", "dist");
const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const INSTANCE_ID = process.env.SATELLITE_INSTANCE_ID?.trim() || crypto.randomUUID();
const APP_ID = "parlor";
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

function hubWsUrl(): string {
  return HUB_URL.replace(/^http/, "ws").replace(/\/$/, "") + "/sap/v1";
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/config.json" && req.method === "GET") {
    return jsonResponse({
      app_id: APP_ID,
      instance_id: INSTANCE_ID,
      hub_ws_url: hubWsUrl(),
      http_url: HTTP_URL,
    });
  }

  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, app: APP_ID, instance_id: INSTANCE_ID });
  }

  return serveStatic(url.pathname);
}

function serveStatic(pathname: string): Response {
  if (!existsSync(DIST_DIR)) {
    return jsonResponse(
      { error: "UI 未构建；请运行 `bun satellites/parlor/dev.ts` 或 `bun build.ts`" },
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

console.log(`parlor satellite ${HTTP_URL} (instance ${INSTANCE_ID})`);

export { server, HTTP_URL, INSTANCE_ID };
