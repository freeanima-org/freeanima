import {
  isWebStaticPath,
  serveWebStatic,
  WEB_URL_PREFIX,
  type WebStaticOptions,
} from "./web-static.ts";
import { createMcpBunHandler, isMcpPath } from "@freeanima/capabilities/mcp-server";
import { HABITAT_BASE_PATH } from "@freeanima/platform/ports/constants";
import type { HabitatTlsBunOptions } from "@freeanima/platform/tls/resolve-habitat-tls";
import { bindHabitatApiLogging } from "./api-logging.ts";
import { bindHabitatRuntimeContext, habitatCtx } from "./handlers/runtime.ts";
import { applyCorsToResponse } from "./cors.ts";
import { broadcastWsReconnect, shutdownAdmin } from "./shutdown.ts";
import { getRemoteToolsServerDeps } from "@freeanima/platform/remote-tools/runtime-context";
import { createSapBunHandlers } from "@freeanima/platform/remote-tools/bun-route";
import { createServiceAuthVerifier, type ServiceAuthVerifier } from "./service-auth.ts";
import {
  applyHttpAuth,
  handleHabitatCorsPreflight,
  trySapWebSocketUpgrade,
} from "./http-dispatch.ts";

export type ApiServerTlsOptions = {
  port: number;
  tls: HabitatTlsBunOptions;
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
  sapHandlers: ReturnType<typeof createSapBunHandlers> | null;
  serviceAuth: ServiceAuthVerifier;
  mcpHandler: ReturnType<typeof createMcpBunHandler>;
  webStatic: WebStaticOptions | null;
};

async function withCors(req: Request, res: Response | Promise<Response>): Promise<Response> {
  return applyCorsToResponse(req, await res);
}

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
  bindHabitatRuntimeContext();
  bindHabitatApiLogging(habitatCtx().engine.logger);
  const sapDeps = getRemoteToolsServerDeps();
  const sapHandlers = sapDeps ? createSapBunHandlers(sapDeps) : null;
  const serviceAuth = options.serviceAuth ?? createServiceAuthVerifier();
  const mcpHandler = createMcpBunHandler({
    toolSets: habitatCtx().engine.catalog.toolSets,
  });
  return {
    sapHandlers,
    serviceAuth,
    mcpHandler,
    webStatic: options.webStatic ?? null,
  };
}

function createApiFetchHandler(runtime: ApiServerRuntime) {
  const { sapHandlers, serviceAuth, mcpHandler, webStatic } = runtime;
  return function apiFetch(req: Request, bunServer: unknown): Response | Promise<Response> {
    const remoteAddress = resolveRemoteAddress(bunServer, req);

    const sapUpgrade = trySapWebSocketUpgrade(req, bunServer as Bun.Server<unknown>, sapHandlers);
    if (sapUpgrade != null) return sapUpgrade;

    // 旧 /rpc/v1 HTTP → /rpc/v1（0.9.3 删除）；WS 已在上方双挂

    const run = async (): Promise<Response> => {
      const preflight = handleHabitatCorsPreflight(req);
      if (preflight) return preflight;

      const pathname = new URL(req.url).pathname;

      if (webStatic && isWebStaticPath(pathname)) {
        const staticRes = serveWebStatic(req, webStatic);
        if (staticRes) return staticRes;
      }

      // 有 /web 路径但未托管：勿落入 Bearer 鉴权变成 401，误导为“未登录”
      if (
        !webStatic &&
        isWebStaticPath(pathname) &&
        (req.method === "GET" || req.method === "HEAD")
      ) {
        return new Response("Web UI 未托管：请先 just pack web，并确认 dist 存在后重启 Habitat", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
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
      if (authResult.blocked) return withCors(req, authResult.blocked);

      const authedReq = authResult.req;
      const authedPath = new URL(authedReq.url).pathname;

      if (isMcpPath(authedPath)) {
        const mcpRes = await mcpHandler(authedReq, {
          callerAuth: authResult.auth,
        });
        if (mcpRes !== undefined) return withCors(req, mcpRes);
      }

      const sapRes = dispatchFetch(authedReq, bunServer, sapHandlers);
      return withCors(req, sapRes ?? new Response("Not Found", { status: 404 }));
    };
    return run();
  };
}

function startApiServerOnHost(
  host: string,
  port: number,
  runtime: ApiServerRuntime,
  tls?: HabitatTlsBunOptions,
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
  const { coalesceBindHosts } = await import("@freeanima/platform/bind-hosts.ts");
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

/** @alias startApiHttpServer */
export const startHubHttpServer = startApiHttpServer;

/** @alias startApiHttpServers */
export const startHubHttpServers = startApiHttpServers;

export { HABITAT_BASE_PATH };
