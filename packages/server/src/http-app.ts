import { logApiError } from "@freeanima/kernel";
import type { NestService } from "@freeanima/runtime";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";


import type { AcpManager, MCPManager } from "@freeanima/integrations";
import { createNodeWebSocket } from "@hono/node-ws";
import type { ServerType } from "@hono/node-server";
import { createApiRoutes } from "./api-routes.js";

const WEBUI_MOUNT = "/webui";

const CORS_ORIGINS = [
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
];

function corsOrigin(origin: string): string | null {
  if (!origin) return CORS_ORIGINS[0] ?? null;
  if (CORS_ORIGINS.includes(origin)) return origin;
  try {
    const u = new URL(origin);
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") return origin;
    if (u.hostname.startsWith("10.") || u.hostname.startsWith("192.168.")) return origin;
  } catch {
    /* ignore */
  }
  return null;
}

export function createApp(
  service: NestService,
  distDir: string,
  host = "",
  port = 0,
  mcp: MCPManager | null = null,
  acp: AcpManager | null = null,
): { app: Hono; injectWebSocket: (server: ServerType) => void } {
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.onError((err, c) => {
    logApiError(c.req.method, c.req.path, 500, err);
    return c.json({ error: String(err) }, 500);
  });

  app.use(
    "*",
    cors({
      origin: (origin) => corsOrigin(origin) ?? CORS_ORIGINS[0]!,
      allowMethods: ["GET", "POST", "PATCH", "PUT", "OPTIONS"],
      allowHeaders: ["*"],
    }),
  );

  app.use("*", async (c, next) => {
    if (service.isShuttingDown()) {
      return c.json({ error: "Server is shutting down" }, 503);
    }
    await next();
  });

  const api = createApiRoutes({ service, host, port, mcp, acp, upgradeWebSocket });
  app.route("/api", api);

  if (existsSync(distDir)) {
    mountWebuiSpa(app, distDir);
  }

  return { app, injectWebSocket };
}

function mountWebuiSpa(app: Hono, root: string): void {
  const resolved = resolve(root);

  app.get("/", (c) => c.redirect(`${WEBUI_MOUNT}/parlor/chat`, 302));

  const serveFile = (rel: string) => {
    const target = resolve(join(resolved, rel));
    if (!target.startsWith(resolved)) return null;
    if (!existsSync(target) || !statSync(target).isFile()) return null;
    return readFileSync(target);
  };

  app.get(`${WEBUI_MOUNT}`, (c) => {
    const buf = serveFile("index.html");
    return buf
      ? c.html(buf.toString("utf-8"))
      : c.text("WebUI not built", 404);
  });

  app.get(`${WEBUI_MOUNT}/*`, (c) => {
    const fullPath = c.req.path.replace(new RegExp(`^${WEBUI_MOUNT}/?`), "");
    const buf = fullPath ? serveFile(fullPath) : serveFile("index.html");
    if (buf) {
      return new Response(buf, {
        headers: { "Content-Type": contentType(fullPath) },
      });
    }
    const index = serveFile("index.html");
    return index
      ? c.html(index.toString("utf-8"))
      : c.text("Not found", 404);
  });
}

function contentType(path: string): string {
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "text/html";
}
