import { existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { jsonResponse, withCors } from "./http/cors.ts";
import { companionModelsDir, publicModelsDir } from "./paths.ts";

const DIST_DIR = join(import.meta.dir, "..", "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".vrm": "model/gltf-binary",
  ".glb": "model/gltf-binary",
  ".woff2": "font/woff2",
};

function fileResponse(filePath: string): Response {
  const ext = extname(filePath);
  const headers = MIME[ext] ? { "Content-Type": MIME[ext]! } : undefined;
  return withCors(new Response(Bun.file(filePath), { headers }));
}

function resolveModelFile(relPath: string): string | null {
  const name = relPath.replace(/^\/models\//, "");
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }

  const userPath = join(companionModelsDir(), name);
  if (existsSync(userPath) && statSync(userPath).isFile()) {
    return userPath;
  }

  const publicPath = join(publicModelsDir(), name);
  if (existsSync(publicPath) && statSync(publicPath).isFile()) {
    return publicPath;
  }

  return null;
}

export function serveStatic(pathname: string): Response {
  const rel = pathname === "/" ? "/index.html" : pathname;

  if (rel.startsWith("/models/")) {
    const modelFile = resolveModelFile(rel);
    if (modelFile) {
      return fileResponse(modelFile);
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

  const publicPath = join(import.meta.dir, "..", "public", rel.replace(/^\//, ""));
  if (existsSync(publicPath) && statSync(publicPath).isFile()) {
    return fileResponse(publicPath);
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
