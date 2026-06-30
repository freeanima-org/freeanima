import { existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

import { resolveHubWsUrl } from "@freeanima/sap-contract/urls";

/** Web UI 在 Hub 上的 URL 前缀 */
export const WEB_URL_PREFIX = "/web";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

export type WebStaticOptions = {
  distDir: string;
  appId?: string;
};

export function isWebStaticPath(pathname: string): boolean {
  return pathname === WEB_URL_PREFIX || pathname.startsWith(`${WEB_URL_PREFIX}/`);
}

function resolveDistFile(distDir: string, rel: string): string | null {
  const normalized = rel.startsWith("/") ? rel.slice(1) : rel;
  const filePath = normalize(join(distDir, normalized));
  const root = normalize(distDir);
  if (!filePath.startsWith(root)) return null;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
  return filePath;
}

function contentTypeForPath(filePath: string): string {
  return MIME[extname(filePath)] ?? "application/octet-stream";
}

function webConfigJsonResponse(req: Request, appId: string): Response {
  const origin = new URL(req.url).origin;
  const body = JSON.stringify({
    app_id: appId,
    hub_url: origin,
    hub_ws_url: resolveHubWsUrl(origin),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function fileResponse(filePath: string): Response {
  const file = Bun.file(filePath);
  return new Response(file, {
    headers: { "Content-Type": contentTypeForPath(filePath) },
  });
}

function indexHtmlResponse(distDir: string): Response | null {
  const indexPath = join(distDir, "index.html");
  if (!existsSync(indexPath)) return null;
  return fileResponse(indexPath);
}

/** 将 /web/... 映射为 dist 内相对路径 */
export function webPathToDistRel(pathname: string): string | null {
  if (!isWebStaticPath(pathname)) return null;
  if (pathname === WEB_URL_PREFIX) return "/";
  return pathname.slice(WEB_URL_PREFIX.length) || "/";
}

/** 按请求读盘返回 Web 静态；/web/config.json 由运行时生成 */
export function serveWebStatic(req: Request, options: WebStaticOptions): Response | null {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (!isWebStaticPath(pathname)) return null;

  if (pathname === WEB_URL_PREFIX) {
    return Response.redirect(`${url.origin}${WEB_URL_PREFIX}/chat`, 302);
  }

  if (pathname === `${WEB_URL_PREFIX}/config.json`) {
    return webConfigJsonResponse(req, options.appId ?? "chat");
  }

  if (pathname === `${WEB_URL_PREFIX}/health`) {
    return new Response(JSON.stringify({ ok: true, app: "web", mode: "hub-static" }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const rel = webPathToDistRel(pathname);
  if (!rel) return null;

  const normalizedRel = rel === "/" ? "/index.html" : rel;
  const filePath = resolveDistFile(options.distDir, normalizedRel);
  if (filePath) return fileResponse(filePath);

  return indexHtmlResponse(options.distDir);
}
