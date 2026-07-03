import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
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

const CONSOLE_PREFIX = "/console";

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "EADDRINUSE"
  );
}

export type StaticServerConfig = {
  appId: string;
  hubWsUrl: string;
};

function resolveConsoleAssetPath(pathname: string): string {
  let rel = pathname.slice(CONSOLE_PREFIX.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) {
    return "index.html";
  }
  return rel;
}

function serveStaticFile(distDir: string, rel: string, res: ServerResponse): boolean {
  const filePath = join(distDir, rel);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
    res.end(readFileSync(filePath));
    return true;
  }
  return false;
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
    if (serveStaticFile(distDir, rel, res)) return;
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

function createConsoleStaticHandler(
  distDir: string,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname !== CONSOLE_PREFIX && !pathname.startsWith(`${CONSOLE_PREFIX}/`)) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }
    const rel = resolveConsoleAssetPath(pathname);
    if (serveStaticFile(distDir, rel, res)) return;
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

function createShellStaticHandler(
  distDir: string,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const rel = pathname === "/" ? "/index.html" : pathname;
    if (serveStaticFile(distDir, rel, res)) return;
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

export async function startShellStaticServer(
  distDir: string,
  portStart: number,
  portAttempts = 10,
): Promise<{ server: Server; url: string; port: number }> {
  let lastError: unknown;
  for (let i = 0; i < portAttempts; i++) {
    const port = portStart + i;
    const server = createServer(createShellStaticHandler(distDir));
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

export async function startConsoleStaticServer(
  distDir: string,
  portStart: number,
  portAttempts = 10,
): Promise<{ server: Server; url: string; port: number }> {
  let lastError: unknown;
  for (let i = 0; i < portAttempts; i++) {
    const port = portStart + i;
    const server = createServer(createConsoleStaticHandler(distDir));
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
