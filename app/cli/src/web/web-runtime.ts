import { PATHS } from "@freeanima/core/config";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { DEFAULT_WEB_HOST, DEFAULT_WEB_PORT, type WebConfigFields } from "@freeanima/core/config";
import { resolveHubWsUrl } from "@freeanima/sap-contract/urls";
import { FileConfig } from "@freeanima/platform/config";
import { startWebStaticServer, type WebStaticServerHandle } from "@freeanima/app-web/static-server";

import { apiGet, resolveProbeHost } from "../service-common.ts";
import { resolveWebDistDir } from "./dist-path.ts";
import { ensureWebDistBuilt } from "./ensure-dist.ts";

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

export function resolveDefaultHubUrlForWeb(): string {
  const data = FileConfig.open().data;
  const tunnelHost = data.tunnel?.hostname?.trim();
  if (tunnelHost) return `https://${tunnelHost}`;
  const publicUrl = data.web?.public_url?.trim();
  if (publicUrl) return publicUrl.replace(/\/$/, "");
  return (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
}

export type StartWebServerOptions = {
  host?: string;
  port?: number;
  dist?: string;
  writePid?: boolean;
  hubUrl?: string;
  /** 跳过 monorepo 自动 build（见 FREEANIMA_WEB_SKIP_BUILD） */
  skipBuild?: boolean;
};

export async function startWebServer(
  opts: StartWebServerOptions = {},
): Promise<WebStaticServerHandle> {
  const cfg = FileConfig.open().data.web;
  const { host, port } = resolveWebHostPort(cfg);
  const bindHost = opts.host ?? host;
  const bindPort = opts.port ?? port;

  await ensureWebDistBuilt({ dist: opts.dist, skipBuild: opts.skipBuild });

  const distDir = resolveWebDistDir(opts.dist);
  const hubUrl = (opts.hubUrl ?? resolveDefaultHubUrlForWeb()).replace(/\/$/, "");

  return startWebStaticServer({
    distDir,
    host: bindHost,
    port: bindPort,
    portAttempts: bindPort === port ? 3 : 1,
    runtime: {
      appId: "chat",
      hubUrl,
      hubWsUrl: resolveHubWsUrl(hubUrl),
    },
    pidFile: opts.writePid === false ? undefined : PATHS.webPidFile,
  });
}

export async function probeWebHealth(host: string, port: number): Promise<boolean> {
  const probeHost = resolveProbeHost(host);
  const health = await apiGet(probeHost, port, "/web/health", 2000);
  return health?.ok === true;
}
