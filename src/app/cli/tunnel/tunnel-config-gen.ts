import { omitUndefined } from "@freeanima/core/util";
import { PATHS } from "@freeanima/core/config";
import { renderCloudflaredConfig } from "@freeanima/platform/connectors/tunnel";
import { loadRuntimeConfigSection } from "@freeanima/platform/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveHubPort } from "./tunnel-hub-port.ts";

export function defaultCredentialsFile(): string {
  return join(PATHS.cloudflaredConfigDir, "credentials.json");
}

export function writeTunnelIngressConfig(params: {
  hostname: string;
  hubPort: number;
  credentialsFile?: string;
  tunnelId?: string;
}): string {
  const credentialsFile = params.credentialsFile ?? defaultCredentialsFile();
  const tunnelId = params.tunnelId;
  mkdirSync(PATHS.cloudflaredConfigDir, { recursive: true });
  const content = renderCloudflaredConfig(
    omitUndefined({
      hostname: params.hostname,
      hubPort: params.hubPort,
      credentialsFile,
      tunnelId,
    }),
  );
  writeFileSync(PATHS.cloudflaredConfigFile, content, "utf-8");
  return PATHS.cloudflaredConfigFile;
}

/** 按当前 Hub 端口刷新 cloudflared ingress（Web UI 由 Hub /web 托管） */
export async function refreshTunnelIngressFromConfig(): Promise<boolean> {
  const cfg = await loadRuntimeConfigSection<{
    hostname?: string;
    cloudflare?: { tunnel_id?: string };
  }>("tunnel");
  if (!cfg?.hostname) return false;
  writeTunnelIngressConfig(
    omitUndefined({
      hostname: cfg.hostname,
      hubPort: resolveHubPort(),
      credentialsFile: defaultCredentialsFile(),
      tunnelId: cfg.cloudflare?.tunnel_id,
    }),
  );
  return true;
}
