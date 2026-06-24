import { WEBUI_BASE_PATH } from "@freeanima/platform/ports/constants";
import { createApiApp } from "./elysia/app.ts";
import { bindWebuiApiLogging } from "./api-logging.ts";
import { bindWebuiRuntimeContext, webuiCtx } from "./handlers/runtime.ts";
import { broadcastWsReconnect, shutdownWebui } from "./elysia/shutdown.ts";
import { getSapServerDeps } from "@freeanima/platform/sap/runtime-context";
import { createSapBunHandlers } from "@freeanima/platform/sap/bun-route";
import {
  accessConfigFromTunnel,
  createAccessJwtVerifier,
  type AccessJwtVerifier,
} from "./access-jwt.ts";
import type { TunnelAccessConfig } from "@freeanima/core/config";

export type ApiServerOptions = {
  accessJwt?: AccessJwtVerifier | null;
  tunnelTeamName?: string;
  tunnelAccess?: TunnelAccessConfig;
};

/** @deprecated 使用 ApiServerOptions */
export type WebuiServerOptions = ApiServerOptions;

export type ApiServerHandle = {
  port: number;
  close: () => void | Promise<void>;
};

/** @deprecated 使用 ApiServerHandle */
export type WebuiServerHandle = ApiServerHandle;

type RouteHandler = (req: Request) => Response | Promise<Response>;

function apiRouteHandler(apiApp: {
  fetch: (req: Request) => Response | Promise<Response>;
}): RouteHandler {
  return (req) => apiApp.fetch(req);
}

function buildRoutes(apiApp: {
  fetch: (req: Request) => Response | Promise<Response>;
}): Record<string, RouteHandler> {
  return {
    "/": apiRouteHandler(apiApp),
    "/api/*": apiRouteHandler(apiApp),
  };
}

function dispatchFetch(
  req: Request,
  bunServer: unknown,
  sapHandlers: ReturnType<typeof createSapBunHandlers> | null,
): Response | undefined {
  if (sapHandlers) {
    const sapRes = sapHandlers.fetch(req, bunServer as never);
    if (sapRes !== undefined) return sapRes;
  }
  return new Response("Not Found", { status: 404 });
}

export async function startApiHttpServer(
  host: string,
  port: number,
  options: ApiServerOptions = {},
): Promise<ApiServerHandle> {
  bindWebuiRuntimeContext();
  bindWebuiApiLogging(webuiCtx().engine.logger);
  const apiApp = createApiApp().compile();
  const sapDeps = getSapServerDeps();
  const sapHandlers = sapDeps ? createSapBunHandlers(sapDeps) : null;

  const accessJwt =
    options.accessJwt ??
    (() => {
      const cfg = accessConfigFromTunnel(options.tunnelTeamName, options.tunnelAccess);
      return cfg ? createAccessJwtVerifier(cfg) : null;
    })();
  if (accessJwt) {
    await accessJwt.preload();
  }

  const server = Bun.serve({
    hostname: host,
    port,
    development: false,
    routes: buildRoutes(apiApp),
    fetch(req, bunServer) {
      const remoteAddress =
        typeof (bunServer as { requestIP?: (r: Request) => { address: string } | null })
          .requestIP === "function"
          ? (bunServer as { requestIP: (r: Request) => { address: string } | null }).requestIP(req)
              ?.address
          : undefined;

      const run = async (): Promise<Response | undefined> => {
        if (accessJwt) {
          const blocked = await accessJwt.verifyRequest(req, remoteAddress);
          if (blocked) return blocked;
        }
        return dispatchFetch(req, bunServer, sapHandlers);
      };
      return run();
    },
    websocket: sapHandlers?.websocket ?? {
      open() {},
      message() {},
      close() {},
    },
  });

  if (!server.port) {
    throw new Error(`API server failed to bind ${host}:${port}`);
  }

  return {
    port: server.port,
    close: () => {
      broadcastWsReconnect();
      shutdownWebui();
      server.stop(true);
    },
  };
}

export async function startApiHttpServers(
  hosts: string[],
  port: number,
  options: ApiServerOptions = {},
): Promise<ApiServerHandle[]> {
  if (hosts.length === 1) {
    return [await startApiHttpServer(hosts[0]!, port, options)];
  }
  return Promise.all(hosts.map((host) => startApiHttpServer(host, port, options)));
}

/** @deprecated 使用 startApiHttpServer */
export const startWebuiHttpServer = startApiHttpServer;

/** @deprecated 使用 startApiHttpServers */
export const startWebuiHttpServers = startApiHttpServers;

export { WEBUI_BASE_PATH };
