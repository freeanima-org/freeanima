import { type Server } from "node:http";
import { join } from "node:path";
import type { ViteDevServer } from "vite";
import { WebSocketServer } from "ws";
import { companionPackageRoot } from "./companion-root.ts";
import { corsPreflight, jsonResponse } from "./http/cors.ts";
import { clientCompanionConfig } from "./config-response.ts";
import { ensureCompanionDataDir } from "./paths.ts";
import { serveSidecarAsset, serveStatic, setStaticDistDir } from "./static.ts";
import { SATELLITE_PORT_ATTEMPTS, SATELLITE_PORT_START } from "../shared/constants.ts";
import { advanceBubble, bubbleState } from "./runtime-state.ts";
import { handleRuntimeWsClose, handleRuntimeWsOpen, runtimeWsPayload } from "./runtime-ws.ts";
import { createNodeHttpServer, listenServer, type DevMiddleware } from "./http/node-bridge.ts";
import { syncCompanionFromHabitat } from "./habitat-sync.ts";

export type StartCompanionServerOptions = {
  port?: number;
  portAttempts?: number;
  distDir?: string;
  host?: string;
  announce?: boolean;
  viteDev?: boolean;
  viteConfigPath?: string;
  devMiddleware?: DevMiddleware;
};

export type CompanionServerHandle = {
  port: number;
  url: string;
  httpServer: Server;
  wss: WebSocketServer;
  vite?: ViteDevServer;
  close: () => Promise<void>;
};

let activeHttpUrl = "";

function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "EADDRINUSE"
  );
}

function announceSidecarPort(port: number): void {
  process.stderr.write(`companion-sidecar-port:${port}\n`);
  console.log(`companion satellite http://127.0.0.1:${port}`);
}

export function getCompanionHttpUrl(): string {
  return activeHttpUrl;
}

export async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return corsPreflight();
  }

  if ((url.pathname === "/config.json" || url.pathname === "/api/config") && req.method === "GET") {
    return jsonResponse(clientCompanionConfig());
  }

  if (url.pathname === "/api/bubbles/advance" && req.method === "POST") {
    return jsonResponse({ current: advanceBubble() });
  }

  if (url.pathname === "/api/runtime/ws") {
    return jsonResponse({ error: "WebSocket upgrade only" }, 426);
  }

  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, app: "companion" });
  }

  const sidecarAsset = serveSidecarAsset(url.pathname);
  if (sidecarAsset) {
    return sidecarAsset;
  }

  if (process.env.SATELLITE_VITE_DEV === "1") {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  return serveStatic(url.pathname);
}

export async function startCompanionServer(
  opts: StartCompanionServerOptions = {},
): Promise<CompanionServerHandle> {
  ensureCompanionDataDir();
  await syncCompanionFromHabitat();

  const portStart = opts.port ?? Number(process.env.SATELLITE_PORT ?? SATELLITE_PORT_START);
  const portAttempts = opts.portAttempts ?? SATELLITE_PORT_ATTEMPTS;
  const host = opts.host ?? "127.0.0.1";

  if (opts.distDir) {
    setStaticDistDir(opts.distDir);
  } else {
    setStaticDistDir(join(companionPackageRoot(), "dist"));
  }

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    handleRuntimeWsOpen(ws);
    ws.send(JSON.stringify(runtimeWsPayload(bubbleState(), [])));
    ws.on("close", () => {
      handleRuntimeWsClose(ws);
    });
  });

  let lastError: unknown;
  for (let i = 0; i < portAttempts; i++) {
    const port = portStart + i;
    const baseUrl = `http://${host}:${port}`;
    let activeDevMiddleware: DevMiddleware | undefined = opts.devMiddleware;
    let viteDevServer: ViteDevServer | undefined;

    const httpServer = createNodeHttpServer({
      port,
      host,
      baseUrl,
      handler: route,
      wss,
      devMiddleware: (req, res, next) => {
        if (activeDevMiddleware) {
          activeDevMiddleware(req, res, next);
          return;
        }
        next();
      },
    });

    if (opts.viteDev) {
      process.env.SATELLITE_VITE_DEV = "1";
      const { createServer: createViteServer } = await import("vite");
      viteDevServer = await createViteServer({
        configFile: opts.viteConfigPath ?? join(companionPackageRoot(), "vite.config.ts"),
        server: {
          middlewareMode: true,
          hmr: { server: httpServer },
        },
      });
      activeDevMiddleware = viteDevServer.middlewares;
    }

    try {
      const boundPort = await listenServer(httpServer, port, host);
      activeHttpUrl = `http://${host}:${boundPort}`;
      if (opts.announce !== false) {
        announceSidecarPort(boundPort);
      }

      return {
        port: boundPort,
        url: activeHttpUrl,
        httpServer,
        wss,
        ...(viteDevServer !== undefined ? { vite: viteDevServer } : {}),
        close: async () => {
          if (viteDevServer) {
            await viteDevServer.close();
          }
          await new Promise<void>((resolve, reject) => {
            wss.close((err) => (err ? reject(err) : resolve()));
          });
          await new Promise<void>((resolve, reject) => {
            httpServer.close((err) => (err ? reject(err) : resolve()));
          });
          if (activeHttpUrl === `http://${host}:${boundPort}`) {
            activeHttpUrl = "";
          }
        },
      };
    } catch (error) {
      lastError = error;
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
      if (isAddrInUse(error) && i < portAttempts - 1) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error(`无法在 ${portStart}–${portStart + portAttempts - 1} 找到可用端口`);
}

export { serveStatic };
