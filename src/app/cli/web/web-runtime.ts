import { omitUndefined } from "@freeanima/core/util";
import { PATHS } from "@freeanima/core/config";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { DEFAULT_WEB_HOST, DEFAULT_WEB_PORT, type WebConfigFields } from "@freeanima/core/config";
import { resolveHubRpcWsUrl } from "@freeanima/shared/hub-rpc";
import { loadRuntimeConfigSection } from "@freeanima/platform/config";
import { loadBootstrapConfig } from "@freeanima/platform/config/bootstrap.ts";
import {
  startWebStaticServer,
  type WebStaticServerHandle,
} from "@freeanima/app/shell/web/lib/static-server.ts";

import { apiGet, resolveProbeHost } from "../service-common.ts";
import { resolveWebDistDir } from "./dist-path.ts";

export { DEFAULT_WEB_HOST, DEFAULT_WEB_PORT };

export function resolveWebHostPort(cfg?: WebConfigFields | null): { host: string; port: number } {
  return {
    host: cfg?.host?.trim() || DEFAULT_WEB_HOST,
    port: cfg?.port ?? DEFAULT_WEB_PORT,
  };
}

export function isWebProcessAlive(): number | null {
  if (!existsSync(PATHS.webPidFile)) return null;
  try {
    const pid = parseInt(readFileSync(PATHS.webPidFile, "utf-8").trim(), 10);
    process.kill(pid, 0);
    return pid;
  } catch {
    try {
      unlinkSync(PATHS.webPidFile);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export async function resolveDefaultHubUrlForWeb(): Promise<string> {
  const tunnel = await loadRuntimeConfigSection<{ hostname?: string }>("tunnel");
  const tunnelHost = tunnel?.hostname?.trim();
  if (tunnelHost) return `https://${tunnelHost}`;
  const publicUrl = loadBootstrapConfig().web?.public_url?.trim();
  if (publicUrl) return publicUrl.replace(/\/$/, "");
  return (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
}

export type StartWebServerOptions = {
  host?: string;
  port?: number;
  dist?: string;
  writePid?: boolean;
  hubUrl?: string;
};

export async function startWebServer(
  opts: StartWebServerOptions = {},
): Promise<WebStaticServerHandle> {
  const cfg = loadBootstrapConfig().web;
  const { host, port } = resolveWebHostPort(cfg);
  const bindHost = opts.host ?? host;
  const bindPort = opts.port ?? port;

  const distDir = resolveWebDistDir(opts.dist);
  const hubUrl = (opts.hubUrl ?? (await resolveDefaultHubUrlForWeb())).replace(/\/$/, "");

  return startWebStaticServer(
    omitUndefined({
      distDir,
      host: bindHost,
      port: bindPort,
      portAttempts: bindPort === port ? 3 : 1,
      runtime: {
        appId: "chat",
        hubUrl,
        hubWsUrl: resolveHubRpcWsUrl(hubUrl),
      },
      pidFile: opts.writePid === false ? undefined : PATHS.webPidFile,
    }),
  );
}

export async function probeWebHealth(host: string, port: number): Promise<boolean> {
  const probeHost = resolveProbeHost(host);
  const health = await apiGet(probeHost, port, "/web/health", 2000);
  return health?.ok === true;
}
