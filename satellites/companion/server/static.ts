import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { jsonResponse, withCors } from "./http/cors.ts";
import { companionPackageRoot } from "./companion-root.ts";
import { resolveModelFile } from "./model-path.ts";
import { resolveMotionFile } from "./motions.ts";

let distDirOverride: string | null = null;

export function setStaticDistDir(dir: string | null): void {
  distDirOverride = dir;
}

function distDir(): string {
  return distDirOverride ?? join(companionPackageRoot(), "dist");
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".vrm": "model/gltf-binary",
  ".vrma": "model/gltf-binary",
  ".glb": "model/gltf-binary",
  ".woff2": "font/woff2",
};

function fileResponse(filePath: string): Response {
  const ext = extname(filePath);
  const headers = MIME[ext] ? { "Content-Type": MIME[ext]! } : undefined;
  const body = readFileSync(filePath);
  return withCors(new Response(body, { headers }));
}

export function serveStatic(pathname: string): Response {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const DIST_DIR = distDir();

  if (rel.startsWith("/models/")) {
    const modelFile = resolveModelFile(rel);
    if (modelFile) {
      return fileResponse(modelFile);
    }
    return jsonResponse({ error: "Not Found" }, 404);
  }

  if (rel.startsWith("/motions/")) {
    const motionFile = resolveMotionFile(rel);
    if (motionFile) {
      return fileResponse(motionFile);
    }
    return jsonResponse({ error: "Not Found" }, 404);
  }

  if (!existsSync(DIST_DIR)) {
    return jsonResponse(
      { error: "UI not built; run `bun satellites/companion/dev.ts` or `bun build.ts`" },
      503,
    );
  }

  const filePath = join(DIST_DIR, rel);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return fileResponse(filePath);
  }

  const publicPath = join(companionPackageRoot(), "public", rel.replace(/^\//, ""));
  if (existsSync(publicPath) && statSync(publicPath).isFile()) {
    return fileResponse(publicPath);
  }

  const indexPath = join(DIST_DIR, "index.html");
  if (existsSync(indexPath)) {
    return fileResponse(indexPath);
  }

  return jsonResponse({ error: "Not Found" }, 404);
}
