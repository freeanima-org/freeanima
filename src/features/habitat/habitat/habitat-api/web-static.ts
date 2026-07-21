import { existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

import { readBuildMetaFile, type ComponentBuildMeta } from "@freeanima/core/config/build-meta";
import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";

/** Web UI 在 Habitat 上的 URL 前缀 */
export const WEB_URL_PREFIX = "/web";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

export type WebStaticOptions = {
  distDir: string;
  appId?: string;
  uiVersion?: string;
  minShellVersion?: string;
  webBuild?: ComponentBuildMeta | null;
};

export function readWebBuildMetaFromDist(distDir: string): ComponentBuildMeta | null {
  const fromFile = readBuildMetaFile(join(distDir, "build-meta.json"));
  if (fromFile?.component === "web") return fromFile;
  return null;
}

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

/** 基于 mtime + size 的弱 ETag，供 index.html 等协商缓存 */
export function buildFileEtag(filePath: string): string {
  const stat = statSync(filePath);
  return `"${stat.mtimeMs.toString(16)}-${stat.size.toString(16)}"`;
}

function webConfigJsonResponse(req: Request, options: WebStaticOptions): Response {
  const origin = new URL(req.url).origin;
  const webBuild =
    options.webBuild === undefined ? readWebBuildMetaFromDist(options.distDir) : options.webBuild;
  const body = JSON.stringify({
    app_id: options.appId ?? "chat",
    habitat_url: origin,
    habitat_ws_url: resolveHabitatRpcWsUrl(origin),
    // @deprecated 0.9.3 后删除 — dual-write
    hub_url: origin,
    hub_ws_url: resolveHabitatRpcWsUrl(origin),
    ...(options.uiVersion ? { ui_version: options.uiVersion } : {}),
    ...(webBuild ? { web_build: webBuild } : {}),
    ...(options.minShellVersion ? { min_shell_version: options.minShellVersion } : {}),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function fileResponse(req: Request, filePath: string): Response {
  const file = Bun.file(filePath);
  const headers: Record<string, string> = { "Content-Type": contentTypeForPath(filePath) };
  const rel = filePath.replace(/\\/g, "/");
  const inAssets = rel.includes("/assets/");

  if (inAssets) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
    return new Response(file, { headers });
  }

  const etag = buildFileEtag(filePath);
  headers.ETag = etag;
  headers["Cache-Control"] = "no-cache";

  const ifNoneMatch = req.headers.get("If-None-Match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(file, { headers });
}

function indexHtmlResponse(req: Request, distDir: string): Response | null {
  const indexPath = join(distDir, "index.html");
  if (!existsSync(indexPath)) return null;
  return fileResponse(req, indexPath);
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
    return webConfigJsonResponse(req, options);
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
  if (filePath) return fileResponse(req, filePath);

  return indexHtmlResponse(req, options.distDir);
}
