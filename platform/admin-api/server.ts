import { ADMIN_BASE_PATH } from "@freeanima/platform/ports/constants";
import { createApiApp } from "./elysia/app.ts";
import { bindAdminApiLogging } from "./api-logging.ts";
import { bindAdminRuntimeContext, adminCtx } from "./handlers/runtime.ts";
import { broadcastWsReconnect, shutdownAdmin } from "./elysia/shutdown.ts";
import { getSapServerDeps } from "@freeanima/platform/sap/runtime-context";
import { createSapBunHandlers } from "@freeanima/platform/sap/bun-route";
import {
  accessConfigFromTunnel,
  createAccessJwtVerifier,
  type AccessJwtVerifier,
} from "./access-jwt.ts";
import { createRemoteAuthVerifier, type RemoteAuthVerifier } from "./remote-auth.ts";
import { applyHttpAuth, attachRemoteAddressToRequest, isHubApiPath } from "./http-dispatch.ts";
import type { TunnelAccessConfig } from "@freeanima/core/config";

export type ApiServerOptions = {
  accessJwt?: AccessJwtVerifier | null;
  remoteAuth?: RemoteAuthVerifier | null;
  remoteAuthToken?: string;
  tunnelTeamName?: string;
  tunnelAccess?: TunnelAccessConfig;
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

  const accessJwt =
    options.accessJwt ??
    (() => {
      const cfg = accessConfigFromTunnel(options.tunnelTeamName, options.tunnelAccess);
      return cfg ? createAccessJwtVerifier(cfg) : null;
    })();
  if (accessJwt) {
    await accessJwt.preload();
  }

  const remoteAuth =
    options.remoteAuth ??
    createRemoteAuthVerifier({
      token: options.remoteAuthToken,
    });

  const server = Bun.serve({
    hostname: host,
    port,
    development: false,
    fetch(req, bunServer) {
      const remoteAddress = resolveRemoteAddress(bunServer, req);
      const run = async (): Promise<Response> => {
        const blocked = await applyHttpAuth(req, remoteAddress, remoteAuth, accessJwt);
        if (blocked) return blocked;

        const pathname = new URL(req.url).pathname;
        if (isHubApiPath(pathname)) {
          return apiApp.fetch(attachRemoteAddressToRequest(req, remoteAddress));
        }

        const sapRes = dispatchFetch(req, bunServer, sapHandlers);
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
