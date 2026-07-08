import {
  isWebStaticPath,
  serveWebStatic,
  WEB_URL_PREFIX,
  type WebStaticOptions,
} from "./web-static.ts";
import { createMcpBunHandler, isMcpPath } from "@freeanima/capabilities-mcp-server";
import { CONSOLE_BASE_PATH } from "@freeanima/platform/ports/constants";
import type { HubTlsBunOptions } from "@freeanima/platform/tls/resolve-hub-tls";
import { createApiApp } from "./elysia/app.ts";
import { bindConsoleApiLogging } from "./api-logging.ts";
import { bindConsoleRuntimeContext, consoleCtx } from "./handlers/runtime.ts";
import { broadcastWsReconnect, shutdownAdmin } from "./elysia/shutdown.ts";
import { getSapServerDeps } from "@freeanima/platform/sap/runtime-context";
import { createSapBunHandlers } from "@freeanima/platform/sap/bun-route";
import { createServiceAuthVerifier, type ServiceAuthVerifier } from "./service-auth.ts";
import { parseServiceAuthFromRequest } from "./auth-context.ts";
import {
  applyHttpAuth,
  handleHubCorsPreflight,
  isHubApiPath,
  trySapWebSocketUpgrade,
} from "./http-dispatch.ts";

export type ApiServerTlsOptions = {
  port: number;
  tls: HubTlsBunOptions;
};

export type ApiServerOptions = {
  serviceAuth?: ServiceAuthVerifier | null;
  webStatic?: WebStaticOptions | null;
  tlsListen?: ApiServerTlsOptions | null;
};

export type ApiServerStartResult = {
  handles: ApiServerHandle[];
  tlsPort: number | null;
};

export type ApiServerHandle = {
  port: number;
  close: () => void | Promise<void>;
};

type ApiServerRuntime = {
  apiApp: ReturnType<ReturnType<typeof createApiApp>["compile"]>;
  sapHandlers: ReturnType<typeof createSapBunHandlers> | null;
  serviceAuth: ServiceAuthVerifier;
  mcpHandler: ReturnType<typeof createMcpBunHandler>;
  webStatic: WebStaticOptions | null;
};

function dispatchFetch(
  req: Request,
  bunServer: unknown,
  sapHandlers: ReturnType<typeof createSapBunHandlers> | null,
): Response | Promise<Response> | undefined {
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

function prepareApiServerRuntime(options: ApiServerOptions): ApiServerRuntime {
  bindConsoleRuntimeContext();
  bindConsoleApiLogging(consoleCtx().engine.logger);
  const apiApp = createApiApp().compile();
  const sapDeps = getSapServerDeps();
  const sapHandlers = sapDeps ? createSapBunHandlers(sapDeps) : null;
  const serviceAuth = options.serviceAuth ?? createServiceAuthVerifier();
  const mcpHandler = createMcpBunHandler({
    toolSets: consoleCtx().engine.catalog.toolSets,
  });
  return {
    apiApp,
    sapHandlers,
    serviceAuth,
    mcpHandler,
    webStatic: options.webStatic ?? null,
  };
}

function createApiFetchHandler(runtime: ApiServerRuntime) {
  const { apiApp, sapHandlers, serviceAuth, mcpHandler, webStatic } = runtime;
  return function apiFetch(req: Request, bunServer: unknown): Response | Promise<Response> {
    const remoteAddress = resolveRemoteAddress(bunServer, req);

    const sapUpgrade = trySapWebSocketUpgrade(req, bunServer as Bun.Server<unknown>, sapHandlers);
    if (sapUpgrade != null) return sapUpgrade;

    const run = async (): Promise<Response> => {
      const preflight = handleHubCorsPreflight(req);
      if (preflight) return preflight;

      const pathname = new URL(req.url).pathname;

      if (webStatic && isWebStaticPath(pathname)) {
        const staticRes = serveWebStatic(
          req,
          webStatic,
          remoteAddress !== undefined ? { remoteAddress } : undefined,
        );
        if (staticRes) return staticRes;
      }

      if (webStatic && pathname === "/favicon.ico" && req.method === "GET") {
        return Response.redirect(
          `${new URL(req.url).origin}${WEB_URL_PREFIX}/icons/icon-192.png`,
          302,
        );
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
        const mcpRes = await mcpHandler(authedReq, {
          callerAuth: parseServiceAuthFromRequest(authedReq),
        });
        if (mcpRes !== undefined) return mcpRes;
      }

      const sapRes = dispatchFetch(authedReq, bunServer, sapHandlers);
      return sapRes ?? new Response("Not Found", { status: 404 });
    };
    return run();
  };
}

function startApiServerOnHost(
  host: string,
  port: number,
  runtime: ApiServerRuntime,
  tls?: HubTlsBunOptions,
): ApiServerHandle {
  const fetch = createApiFetchHandler(runtime);
  const server = Bun.serve({
    hostname: host,
    port,
    development: false,
    fetch,
    websocket: runtime.sapHandlers?.websocket ?? {
      open() {},
      message() {},
      close() {},
    },
    ...(tls ? { tls } : {}),
  });

  if (!server.port) {
    throw new Error(`API server failed to bind ${host}:${port}`);
  }

  return {
    port: server.port,
    close: () => {
      broadcastWsReconnect();
      shutdownAdmin();
      void server.stop(true);
    },
  };
}

export async function startApiHttpServer(
  host: string,
  port: number,
  options: ApiServerOptions = {},
): Promise<ApiServerHandle> {
  const runtime = prepareApiServerRuntime(options);
  return startApiServerOnHost(host, port, runtime);
}

export async function startApiHttpServers(
  hosts: string[],
  port: number,
  options: ApiServerOptions = {},
): Promise<ApiServerStartResult> {
  const { coalesceBindHosts } = await import("@freeanima/platform/bind-hosts");
  const bindHosts = coalesceBindHosts(hosts);
  const runtime = prepareApiServerRuntime(options);
  const handles: ApiServerHandle[] = [];

  for (const host of bindHosts) {
    handles.push(startApiServerOnHost(host, port, runtime));
  }

  const tlsListen = options.tlsListen;
  let tlsPort: number | null = null;
  if (tlsListen) {
    tlsPort = tlsListen.port;
    for (const host of bindHosts) {
      handles.push(startApiServerOnHost(host, tlsListen.port, runtime, tlsListen.tls));
    }
  }

  return { handles, tlsPort };
}

export { CONSOLE_BASE_PATH };
