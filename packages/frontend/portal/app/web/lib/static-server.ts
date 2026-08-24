import type { Server as BunServer } from "bun";
import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { extname, join } from "node:path";

import { isRecord } from "@freeanima/shared/util";

const WEB_PREFIX = "/web";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function isAddrInUse(error: unknown): boolean {
  return isRecord(error) && error.code === "EADDRINUSE";
}

export type WebStaticRuntimeConfig = {
  appId?: string;
  /** Habitat REST 根 URL，供 /config.json 与设置页默认提示 */
  habitatUrl?: string;
  habitatWsUrl?: string;
  uiVersion?: string;
  minShellVersion?: string;
};

export type WebStaticServerOptions = {
  distDir: string;
  host: string;
  port: number;
  portAttempts?: number;
  runtime?: WebStaticRuntimeConfig;
  pidFile?: string;
};

export type WebStaticServerHandle = {
  server: BunServer<undefined>;
  url: string;
  port: number;
  host: string;
  close: () => Promise<void>;
};

function serveStaticFile(distDir: string, rel: string): Response | null {
  const normalized = rel.startsWith("/") ? rel.slice(1) : rel;
  const filePath = join(distDir, normalized);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    const headers: Record<string, string> = {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
    };
    if (normalized.startsWith("assets/")) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }
    return new Response(readFileSync(filePath), { headers });
  }
  return null;
}

function createShellStaticFetch(
  distDir: string,
  runtime?: WebStaticRuntimeConfig,
): (req: Request) => Response {
  return (req: Request): Response => {
    const pathname = new URL(req.url).pathname;

    if (pathname === WEB_PREFIX) {
      return Response.redirect(`${WEB_PREFIX}/chat`, 302);
    }

    if (pathname === `${WEB_PREFIX}/config.json`) {
      const origin = new URL(req.url).origin;
      const habitatUrl = (runtime?.habitatUrl?.trim() || origin).replace(/\/$/, "");
      const habitatWsUrl =
        runtime?.habitatWsUrl?.trim() || `${habitatUrl.replace(/^http/, "ws")}/rpc/v1`;
      return new Response(
        JSON.stringify({
          app_id: runtime?.appId ?? "chat",
          habitat_url: habitatUrl,
          habitat_ws_url: habitatWsUrl,
          ui_version: runtime?.uiVersion,
          min_shell_version: runtime?.minShellVersion,
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // 探活用 /web/healthz；/web/health 留给健康记录 SPA
    if (pathname === `${WEB_PREFIX}/healthz`) {
      return new Response(JSON.stringify({ ok: true, app: "web", mode: "static" }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (!pathname.startsWith(`${WEB_PREFIX}/`)) {
      return new Response("Not Found", { status: 404 });
    }

    const rel = pathname.slice(WEB_PREFIX.length) || "/";
    const fileRel = rel === "/" ? "/index.html" : rel;
    const fileRes = serveStaticFile(distDir, fileRel);
    if (fileRes) return fileRes;

    const indexPath = join(distDir, "index.html");
    if (existsSync(indexPath)) {
      return new Response(readFileSync(indexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  };
}

export async function startWebStaticServer(
  options: WebStaticServerOptions,
): Promise<WebStaticServerHandle> {
  const { distDir, host, port, portAttempts = 1, runtime, pidFile } = options;
  if (!existsSync(join(distDir, "index.html"))) {
    throw new Error(`Web dist 不存在或缺少 index.html: ${distDir}`);
  }

  const fetchHandler = createShellStaticFetch(distDir, runtime);

  let lastError: unknown;
  for (let i = 0; i < portAttempts; i++) {
    const attemptPort = port === 0 ? 0 : port + i;
    try {
      const server = Bun.serve({
        hostname: host,
        port: attemptPort,
        fetch: fetchHandler,
      });

      const actualPort = server.port;
      if (actualPort == null) {
        throw new Error(`Web 静态服绑定失败: ${host}:${attemptPort}`);
      }
      let cleanupPid: (() => void) | undefined;
      if (pidFile) {
        writeFileSync(pidFile, String(process.pid), "utf-8");
        cleanupPid = (): void => {
          try {
            unlinkSync(pidFile);
          } catch {
            /* ignore */
          }
        };
        process.once("exit", cleanupPid);
      }

      const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
      const url = `http://${displayHost}:${actualPort}${WEB_PREFIX}`;
      return {
        server,
        url,
        port: actualPort,
        host,
        close: async () => {
          void server.stop(true);
          cleanupPid?.();
        },
      };
    } catch (error) {
      lastError = error;
      if (isAddrInUse(error) && i < portAttempts - 1) continue;
      throw error;
    }
  }
  throw lastError ?? new Error(`无法在 ${port} 绑定 Web 静态服`);
}
