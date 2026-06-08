import { join } from "node:path";
import { getRepoRoot } from "@freeanima/service-config";
import { createApiApp, WEBUI_BASE_PATH } from "./elysia/app.ts";
import { broadcastWsReconnect, shutdownWebui } from "./elysia/shutdown.ts";

export type WebuiServerOptions = {
  development?: boolean;
};

export type WebuiServerHandle = {
  port: number;
  close: () => void | Promise<void>;
};

type WebuiRouteValue = Bun.HTMLBundle;

/** 仅在 WebUI 监听启动时加载；close 后释放引用以便 GC */
let cachedHtmlBundle: WebuiRouteValue | null = null;

async function loadWebuiHtmlBundle(): Promise<WebuiRouteValue> {
  if (!cachedHtmlBundle) {
    const htmlPath = join(getRepoRoot(), "connectors/webui/app/index.html");
    cachedHtmlBundle = (await import(/* @vite-ignore */ htmlPath)).default;
  }
  return cachedHtmlBundle!;
}

function releaseWebuiHtmlBundle(): void {
  cachedHtmlBundle = null;
}

function webuiRoutes(handler: WebuiRouteValue): Record<string, WebuiRouteValue> {
  return {
    [WEBUI_BASE_PATH]: handler,
    [`${WEBUI_BASE_PATH}/*`]: handler,
  };
}

export async function startWebuiHttpServer(
  host: string,
  port: number,
  options: WebuiServerOptions = {},
): Promise<WebuiServerHandle> {
  const development = options.development ?? process.env.NODE_ENV !== "production";
  if (development) {
    process.env.NODE_ENV = "development";
  }

  const webuiHtml = await loadWebuiHtmlBundle();
  const apiApp = createApiApp().compile();

  const server = Bun.serve({
    hostname: host,
    port,
    development: development ? { console: true } : false,
    routes: webuiRoutes(webuiHtml),
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/" || url.pathname === "") {
        return apiApp.fetch(req);
      }
      if (url.pathname.startsWith("/api")) {
        return apiApp.fetch(req);
      }
      return undefined as unknown as Response;
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
