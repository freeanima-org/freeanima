import { PATHS } from "@freeanima/core/config";
import { renderCloudflaredConfig } from "@freeanima/platform/connectors/tunnel";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FileConfig } from "@freeanima/platform/config";

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
  const tunnelId =
    params.tunnelId ?? FileConfig.open().data.tunnel?.cloudflare?.tunnel_id ?? undefined;
  mkdirSync(PATHS.cloudflaredConfigDir, { recursive: true });
  const content = renderCloudflaredConfig(
    params.hostname,
    params.hubPort,
    credentialsFile,
    tunnelId,
  );
  writeFileSync(PATHS.cloudflaredConfigFile, content, "utf-8");
  return PATHS.cloudflaredConfigFile;
}
