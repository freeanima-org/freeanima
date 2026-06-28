import { DEFAULT_WEB_PORT, type WebConfigFields } from "@freeanima/core/config";
import { FileConfig } from "@freeanima/platform/config";

export function resolveWebPort(cfg?: WebConfigFields | null): number {
  return cfg?.port ?? FileConfig.open().data.web?.port ?? DEFAULT_WEB_PORT;
}

export function resolveWebHostname(): string | undefined {
  const tunnel = FileConfig.open().data.tunnel;
  return tunnel?.web_hostname?.trim() || undefined;
}
