import { PATHS } from "@freeanima/core/config";
import { renderCloudflaredConfig } from "@freeanima/platform/connectors/tunnel";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FileConfig } from "@freeanima/platform/config";
import { resolveHubPort } from "./tunnel-hub-port.ts";
import { resolveWebHostname, resolveWebPort } from "../web/web-config.ts";

export function defaultCredentialsFile(): string {
  return join(PATHS.cloudflaredConfigDir, "credentials.json");
}

export function writeTunnelIngressConfig(params: {
  hostname: string;
  hubPort: number;
  credentialsFile?: string;
  tunnelId?: string;
  webHostname?: string;
  webPort?: number;
}): string {
  const credentialsFile = params.credentialsFile ?? defaultCredentialsFile();
  const tunnelId =
    params.tunnelId ?? FileConfig.open().data.tunnel?.cloudflare?.tunnel_id ?? undefined;
  const cfg = FileConfig.open().data;
  const webHostname = params.webHostname ?? resolveWebHostname();
  const webPort = params.webPort ?? (cfg.web?.enabled ? resolveWebPort(cfg.web) : undefined);
  mkdirSync(PATHS.cloudflaredConfigDir, { recursive: true });
  const content = renderCloudflaredConfig({
    hostname: params.hostname,
    hubPort: params.hubPort,
    credentialsFile,
    tunnelId,
    webHostname,
    webPort: webHostname ? webPort : undefined,
  });
  writeFileSync(PATHS.cloudflaredConfigFile, content, "utf-8");
  return PATHS.cloudflaredConfigFile;
}

/** 按当前 Hub/Web 端口刷新 cloudflared ingress */
export function refreshTunnelIngressFromConfig(): boolean {
  const fileCfg = FileConfig.open().data;
  const cfg = fileCfg.tunnel;
  if (!cfg?.hostname) return false;
  const webHostname = cfg.web_hostname?.trim();
  const webEnabled = fileCfg.web?.enabled === true || Boolean(webHostname);
  writeTunnelIngressConfig({
    hostname: cfg.hostname,
    hubPort: resolveHubPort(),
    credentialsFile: defaultCredentialsFile(),
    tunnelId: cfg.cloudflare?.tunnel_id,
    webHostname,
    webPort: webEnabled ? resolveWebPort(fileCfg.web) : undefined,
  });
  return true;
}
