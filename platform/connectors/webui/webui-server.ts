import { join } from "node:path";
import { createApiApp, WEBUI_BASE_PATH } from "./elysia/app.ts";
import { bindWebuiApiLogging } from "./api-logging.ts";
import { bindWebuiRuntimeContext, webuiCtx } from "./handlers/runtime.ts";
import { broadcastWsReconnect, shutdownWebui } from "./elysia/shutdown.ts";
import { getSapServerDeps } from "@freeanima/platform/sap/runtime-context";
import { createSapBunHandlers } from "@freeanima/platform/sap/bun-route";
import {
  ensureWebuiDevCacheDir,
  ensureWebuiProductionCacheDir,
  releaseWebuiHtmlBundle,
} from "./webui-bundle.ts";

export type WebuiServerOptions = {
  development?: boolean;
};

export type WebuiServerHandle = {
  port: number;
  close: () => void | Promise<void>;
};

type RouteHandler = (req: Request) => Response | Promise<Response>;

const WEBUI_HTML_NAME = "index.html";

function apiRouteHandler(apiApp: {
  fetch: (req: Request) => Response | Promise<Response>;
}): RouteHandler {
  return (req) => apiApp.fetch(req);
}

/** 将 /webui/... 映射为缓存目录内相对路径（SPA 路由回退 index.html） */
export function resolveProductionWebuiAssetPath(pathname: string): string {
  let rel = pathname.slice(WEBUI_BASE_PATH.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) {
    return WEBUI_HTML_NAME;
  }
  return rel;
}

function serveProductionWebui(pathname: string, cacheDir: string): Response | null {
  if (pathname !== WEBUI_BASE_PATH && !pathname.startsWith(`${WEBUI_BASE_PATH}/`)) {
    return null;
  }
  const rel = resolveProductionWebuiAssetPath(pathname);
  const asset = Bun.file(join(cacheDir, rel));
  if (asset.size > 0) {
    return new Response(asset);
  }
  const index = Bun.file(join(cacheDir, WEBUI_HTML_NAME));
  if (index.size > 0) {
    return new Response(index);
  }
  return null;
}

function staticWebuiRouteHandler(cacheDir: string): RouteHandler {
  return (req) => {
    const pathname = new URL(req.url).pathname;
    return serveProductionWebui(pathname, cacheDir) ?? new Response("Not Found", { status: 404 });
  };
}

function buildRoutes(
  apiApp: { fetch: (req: Request) => Response | Promise<Response> },
  cacheDir: string,
): Record<string, RouteHandler> {
  const webuiHandler = staticWebuiRouteHandler(cacheDir);
  return {
    "/": apiRouteHandler(apiApp),
    "/api/*": apiRouteHandler(apiApp),
    [WEBUI_BASE_PATH]: webuiHandler,
    [`${WEBUI_BASE_PATH}/*`]: webuiHandler,
  };
}

export async function startWebuiHttpServer(
  host: string,
  port: number,
  options: WebuiServerOptions = {},
): Promise<WebuiServerHandle> {
  bindWebuiRuntimeContext();
  bindWebuiApiLogging(webuiCtx().engine.logger);
  const development = options.development ?? false;

  const cacheDir = development
    ? await ensureWebuiDevCacheDir()
    : await ensureWebuiProductionCacheDir();
  const apiApp = createApiApp().compile();
  const sapDeps = getSapServerDeps();
  const sapHandlers = sapDeps ? createSapBunHandlers(sapDeps) : null;

  const server = Bun.serve({
    hostname: host,
    port,
    development: false,
    routes: buildRoutes(apiApp, cacheDir),
    fetch(req, bunServer) {
      if (sapHandlers) {
        const sapRes = sapHandlers.fetch(req, bunServer as never);
        if (sapRes !== undefined) return sapRes;
      }
      return new Response("Not Found", { status: 404 });
    },
    websocket: sapHandlers?.websocket ?? {
      open() {},
      message() {},
      close() {},
    },
  });

  if (!server.port) {
    releaseWebuiHtmlBundle();
    throw new Error(`WebUI server failed to bind ${host}:${port}`);
  }

  return {
    port: server.port,
    close: () => {
      broadcastWsReconnect();
      shutdownWebui();
      server.stop(true);
      releaseWebuiHtmlBundle();
    },
  };
}

export async function startWebuiHttpServers(
  hosts: string[],
  port: number,
  options: WebuiServerOptions = {},
): Promise<WebuiServerHandle[]> {
  if (hosts.length === 1) {
    return [await startWebuiHttpServer(hosts[0]!, port, options)];
  }
  return Promise.all(hosts.map((host) => startWebuiHttpServer(host, port, options)));
}

export { WEBUI_BASE_PATH };
export type { App } from "./elysia/app.ts";
