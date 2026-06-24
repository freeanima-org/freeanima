import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const ADMIN_PREFIX = "/admin";

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "EADDRINUSE"
  );
}

export type StaticServerConfig = {
  appId: string;
  hubWsUrl: string;
};

export type AdminStaticServerConfig = {
  /** Hub REST 根（如 http://127.0.0.1:2658），用于代理 /api/* */
  hubOrigin: string;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function pickForwardHeaders(headers: IncomingMessage["headers"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

async function proxyApiToHub(
  req: IncomingMessage,
  res: ServerResponse,
  hubOrigin: string,
): Promise<void> {
  const hubBase = hubOrigin.replace(/\/$/, "");
  const targetUrl = `${hubBase}${req.url ?? "/"}`;
  const method = req.method ?? "GET";
  const body = await readRequestBody(req);
  const response = await fetch(targetUrl, {
    method,
    headers: pickForwardHeaders(req.headers),
    body: body ? new Uint8Array(body) : undefined,
  });
  res.statusCode = response.status;
  for (const [key, value] of response.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    res.setHeader(key, value);
  }
  if (response.body) {
    await pipeline(
      Readable.fromWeb(
        response.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
      ),
      res,
    );
  } else {
    res.end();
  }
}

function resolveAdminAssetPath(pathname: string): string {
  let rel = pathname.slice(ADMIN_PREFIX.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) {
    return "index.html";
  }
  return rel;
}

function createStaticHandler(
  distDir: string,
  config?: StaticServerConfig,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/config.json" && config) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ app_id: config.appId, hub_ws_url: config.hubWsUrl }));
      return;
    }
    const rel = pathname === "/" ? "/index.html" : pathname;
    const filePath = join(distDir, rel);
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
      res.end(readFileSync(filePath));
      return;
    }
    const indexPath = join(distDir, "index.html");
    if (existsSync(indexPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(readFileSync(indexPath));
      return;
    }
    res.statusCode = 404;
    res.end("Not Found");
  };
}

function createAdminStaticHandler(
  distDir: string,
  config?: AdminStaticServerConfig,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void (async () => {
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (config?.hubOrigin && pathname.startsWith("/api/")) {
        await proxyApiToHub(req, res, config.hubOrigin);
        return;
      }
      if (pathname !== ADMIN_PREFIX && !pathname.startsWith(`${ADMIN_PREFIX}/`)) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }
      const rel = resolveAdminAssetPath(pathname);
      const filePath = join(distDir, rel);
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath);
        res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
        res.end(readFileSync(filePath));
        return;
      }
      const indexPath = join(distDir, "index.html");
      if (existsSync(indexPath)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(readFileSync(indexPath));
        return;
      }
      res.statusCode = 404;
      res.end("Not Found");
    })().catch(() => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end("Proxy Error");
      }
    });
  };
}

function listenStatic(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.removeListener("error", onError);
      resolve(port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

export async function startStaticServer(
  distDir: string,
  portStart: number,
  portAttempts = 10,
  config?: StaticServerConfig,
): Promise<{ server: Server; url: string; port: number }> {
  let lastError: unknown;
  for (let i = 0; i < portAttempts; i++) {
    const port = portStart + i;
    const server = createServer(createStaticHandler(distDir, config));
    try {
      const boundPort = await listenStatic(server, port);
      const url = `http://127.0.0.1:${boundPort}`;
      return { server, url, port: boundPort };
    } catch (error) {
      server.close();
      lastError = error;
      if (isAddrInUse(error) && i < portAttempts - 1) continue;
      throw error;
    }
  }
  throw lastError ?? new Error(`无法在 ${portStart}–${portStart + portAttempts - 1} 找到可用端口`);
}

function createShellStaticHandler(
  distDir: string,
  config?: AdminStaticServerConfig,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void (async () => {
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (config?.hubOrigin && pathname.startsWith("/api/")) {
        await proxyApiToHub(req, res, config.hubOrigin);
        return;
      }
      const rel = pathname === "/" ? "/index.html" : pathname;
      const filePath = join(distDir, rel);
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath);
        res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
        res.end(readFileSync(filePath));
        return;
      }
      const indexPath = join(distDir, "index.html");
      if (existsSync(indexPath)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(readFileSync(indexPath));
        return;
      }
      res.statusCode = 404;
      res.end("Not Found");
    })().catch(() => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end("Proxy Error");
      }
    });
  };
}

export async function startShellStaticServer(
  distDir: string,
  portStart: number,
  portAttempts = 10,
  config?: AdminStaticServerConfig,
): Promise<{ server: Server; url: string; port: number }> {
  let lastError: unknown;
  for (let i = 0; i < portAttempts; i++) {
    const port = portStart + i;
    const server = createServer(createShellStaticHandler(distDir, config));
    try {
      const boundPort = await listenStatic(server, port);
      const url = `http://127.0.0.1:${boundPort}`;
      return { server, url, port: boundPort };
    } catch (error) {
      server.close();
      lastError = error;
      if (isAddrInUse(error) && i < portAttempts - 1) continue;
      throw error;
    }
  }
  throw lastError ?? new Error(`无法在 ${portStart}–${portStart + portAttempts - 1} 找到可用端口`);
}

export async function startAdminStaticServer(
  distDir: string,
  portStart: number,
  portAttempts = 10,
  config?: AdminStaticServerConfig,
): Promise<{ server: Server; url: string; port: number }> {
  let lastError: unknown;
  for (let i = 0; i < portAttempts; i++) {
    const port = portStart + i;
    const server = createServer(createAdminStaticHandler(distDir, config));
    try {
      const boundPort = await listenStatic(server, port);
      const url = `http://127.0.0.1:${boundPort}`;
      return { server, url, port: boundPort };
    } catch (error) {
      server.close();
      lastError = error;
      if (isAddrInUse(error) && i < portAttempts - 1) continue;
      throw error;
    }
  }
  throw lastError ?? new Error(`无法在 ${portStart}–${portStart + portAttempts - 1} 找到可用端口`);
}
