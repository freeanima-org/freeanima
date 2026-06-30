import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { extname, join } from "node:path";

const WEB_PREFIX = "/web";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "EADDRINUSE"
  );
}

export type WebStaticRuntimeConfig = {
  appId?: string;
  /** Hub REST 根 URL，供 /config.json 与设置页默认提示 */
  hubUrl?: string;
  hubWsUrl?: string;
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
  server: Server;
  url: string;
  port: number;
  host: string;
  close: () => Promise<void>;
};

function serveStaticFile(distDir: string, rel: string, res: ServerResponse): boolean {
  const normalized = rel.startsWith("/") ? rel.slice(1) : rel;
  const filePath = join(distDir, normalized);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
    res.end(readFileSync(filePath));
    return true;
  }
  return false;
}

function createShellStaticHandler(
  distDir: string,
  runtime?: WebStaticRuntimeConfig,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;

    if (pathname === WEB_PREFIX) {
      res.statusCode = 302;
      res.setHeader("Location", `${WEB_PREFIX}/chat`);
      res.end();
      return;
    }

    if (pathname === `${WEB_PREFIX}/config.json`) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(
        JSON.stringify({
          app_id: runtime?.appId ?? "chat",
          hub_url: runtime?.hubUrl ?? "",
          hub_ws_url: runtime?.hubWsUrl ?? "",
        }),
      );
      return;
    }
    if (pathname === `${WEB_PREFIX}/health`) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true, app: "web", mode: "static" }));
      return;
    }

    if (!pathname.startsWith(`${WEB_PREFIX}/`)) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    const rel = pathname.slice(WEB_PREFIX.length) || "/";
    const fileRel = rel === "/" ? "/index.html" : rel;
    if (serveStaticFile(distDir, fileRel, res)) return;
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

function listenStatic(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.removeListener("error", onError);
      const addr = server.address();
      const actual = addr && typeof addr === "object" && "port" in addr ? addr.port : port;
      resolve(actual);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

export async function startWebStaticServer(
  options: WebStaticServerOptions,
): Promise<WebStaticServerHandle> {
  const { distDir, host, port, portAttempts = 1, runtime, pidFile } = options;
  if (!existsSync(join(distDir, "index.html"))) {
    throw new Error(`Web dist 不存在或缺少 index.html: ${distDir}`);
  }

  let lastError: unknown;
  for (let i = 0; i < portAttempts; i++) {
    const attemptPort = port + i;
    const server = createServer(createShellStaticHandler(distDir, runtime));
    try {
      const boundPort = await listenStatic(server, host, attemptPort);
      const addr = server.address();
      const actualPort = addr && typeof addr === "object" && "port" in addr ? addr.port : boundPort;
      if (pidFile) {
        writeFileSync(pidFile, String(process.pid), "utf-8");
        const cleanupPid = (): void => {
          try {
            unlinkSync(pidFile);
          } catch {
            /* ignore */
          }
        };
        server.on("close", cleanupPid);
        process.once("exit", cleanupPid);
      }
      const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
      const url = `http://${displayHost}:${actualPort}${WEB_PREFIX}`;
      return {
        server,
        url,
        port: actualPort,
        host,
        close: () =>
          new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
          }),
      };
    } catch (error) {
      server.close();
      lastError = error;
      if (isAddrInUse(error) && i < portAttempts - 1) continue;
      throw error;
    }
  }
  throw lastError ?? new Error(`无法在 ${port} 绑定 Web 静态服`);
}
