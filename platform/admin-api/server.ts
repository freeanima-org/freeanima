import {
  isWebStaticPath,
  serveWebStatic,
  WEB_URL_PREFIX,
  type WebStaticOptions,
} from "./web-static.ts";
import { createMcpBunHandler, isMcpPath } from "@freeanima/capabilities-mcp-server";
import { ADMIN_BASE_PATH } from "@freeanima/platform/ports/constants";
import { createApiApp } from "./elysia/app.ts";
import { bindAdminApiLogging } from "./api-logging.ts";
import { bindAdminRuntimeContext, adminCtx } from "./handlers/runtime.ts";
import { broadcastWsReconnect, shutdownAdmin } from "./elysia/shutdown.ts";
import { getSapServerDeps } from "@freeanima/platform/sap/runtime-context";
import { createSapBunHandlers } from "@freeanima/platform/sap/bun-route";
import { createServiceAuthVerifier, type ServiceAuthVerifier } from "./service-auth.ts";
import {
  applyHttpAuth,
  handleHubCorsPreflight,
  isHubApiPath,
  trySapWebSocketUpgrade,
} from "./http-dispatch.ts";

export type ApiServerOptions = {
  serviceAuth?: ServiceAuthVerifier | null;
  webStatic?: WebStaticOptions | null;
};

export type ApiServerHandle = {
  port: number;
  close: () => void | Promise<void>;
};

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

function resolveRemoteAddress(bunServer: unknown, req: Request): string | undefined {
  if (
    typeof (bunServer as { requestIP?: (r: Request) => { address: string } | null }).requestIP !==
    "function"
  ) {
    return undefined;
  }
  return (bunServer as { requestIP: (r: Request) => { address: string } | null }).requestIP(req)
    ?.address;
}

export async function startApiHttpServer(
  host: string,
  port: number,
  options: ApiServerOptions = {},
): Promise<ApiServerHandle> {
  bindAdminRuntimeContext();
  bindAdminApiLogging(adminCtx().engine.logger);
  const apiApp = createApiApp().compile();
  const sapDeps = getSapServerDeps();
  const sapHandlers = sapDeps ? createSapBunHandlers(sapDeps) : null;

  const serviceAuth = options.serviceAuth ?? createServiceAuthVerifier();

  const mcpHandler = createMcpBunHandler({
    toolSets: adminCtx().engine.catalog.toolSets,
  });

  const webStatic = options.webStatic ?? null;

  const server = Bun.serve({
    hostname: host,
    port,
    development: false,
    fetch(req, bunServer) {
      const remoteAddress = resolveRemoteAddress(bunServer, req);

      const sapUpgrade = trySapWebSocketUpgrade(req, bunServer as Bun.Server<unknown>, sapHandlers);
      if (sapUpgrade !== null) return sapUpgrade;

      const run = async (): Promise<Response> => {
        const preflight = handleHubCorsPreflight(req);
        if (preflight) return preflight;

        const pathname = new URL(req.url).pathname;

        if (webStatic && isWebStaticPath(pathname)) {
          const staticRes = serveWebStatic(req, webStatic);
          if (staticRes) return staticRes;
        }

        if (webStatic && pathname === "/" && req.method === "GET") {
          return Response.redirect(`${new URL(req.url).origin}${WEB_URL_PREFIX}/chat`, 302);
        }

        const authResult = await applyHttpAuth(req, remoteAddress, serviceAuth);
        if (authResult.blocked) return authResult.blocked;

        const authedReq = authResult.req;
        const authedPath = new URL(authedReq.url).pathname;
        if (isHubApiPath(authedPath)) {
          return apiApp.fetch(authedReq);
        }

        if (isMcpPath(authedPath)) {
          const mcpRes = await mcpHandler(authedReq);
          if (mcpRes !== undefined) return mcpRes;
        }

        const sapRes = dispatchFetch(authedReq, bunServer, sapHandlers);
        return sapRes ?? new Response("Not Found", { status: 404 });
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
      shutdownAdmin();
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

export { ADMIN_BASE_PATH };
