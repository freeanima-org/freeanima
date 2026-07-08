import {
  DEFAULT_HUB_TLS_PORT,
  PATHS,
  type HttpConfig,
  type HttpTlsConfigFields,
  collectHttpAllowedHosts,
} from "@freeanima/core/config";
import { omitUndefined } from "@freeanima/core/util";
import { resolveValue } from "@freeanima/platform/config";

import {
  defaultHubTlsCertPath,
  defaultHubTlsKeyPath,
  ensureHubTlsMaterial,
  type HubTlsMaterial,
} from "./hub-tls-material.ts";

export type ResolvedHubTlsListenConfig = {
  enabled: true;
  port: number;
  material: HubTlsMaterial;
};

async function resolveOptionalConfigString(value: string | undefined): Promise<string | undefined> {
  if (value === undefined || value.trim() === "") return undefined;
  return resolveValue(value);
}

export async function resolveHubTlsListenConfig(
  http: HttpConfig | undefined,
  bindHosts: string[],
): Promise<ResolvedHubTlsListenConfig | null> {
  const tls: HttpTlsConfigFields | undefined = http?.tls ?? undefined;
  if (!tls?.enabled) return null;

  const certRaw = (await resolveOptionalConfigString(tls.cert)) ?? defaultHubTlsCertPath();
  const keyRaw = (await resolveOptionalConfigString(tls.key)) ?? defaultHubTlsKeyPath();
  const passphrase = await resolveOptionalConfigString(tls.passphrase);

  const material = ensureHubTlsMaterial({
    certPath: certRaw,
    keyPath: keyRaw,
    auto: tls.auto ?? true,
    bindHosts,
    allowedHosts: collectHttpAllowedHosts(http),
    ...(passphrase ? { passphrase } : {}),
  });

  return {
    enabled: true,
    port: tls.port ?? DEFAULT_HUB_TLS_PORT,
    material,
  };
}

export type HubTlsBunOptions = {
  key: ReturnType<typeof Bun.file>;
  cert: ReturnType<typeof Bun.file>;
  passphrase?: string;
};

export function toHubTlsBunOptions(material: HubTlsMaterial): HubTlsBunOptions {
  return omitUndefined({
    key: Bun.file(material.keyPath),
    cert: Bun.file(material.certPath),
    ...(material.passphrase ? { passphrase: material.passphrase } : {}),
  });
}

export { PATHS };
