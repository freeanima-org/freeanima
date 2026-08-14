import {
  DEFAULT_HABITAT_TLS_PORT,
  resolveHttpTlsMode,
  type HttpConfig,
  type HttpTlsConfigFields,
  collectHttpAllowedHosts,
} from "@freeanima/habitat/core/config";
import { PATHS } from "@freeanima/habitat/core/config/paths";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { resolveValue } from "@freeanima/habitat/platform/config";

import {
  defaultHabitatTlsCertPath,
  defaultHabitatTlsKeyPath,
  ensureHabitatTlsMaterial,
  type HabitatTlsMaterial,
} from "./habitat-tls-material.ts";
import {
  ensureAcmeMaterial,
  startAcmeChallengeServer,
  type AcmeChallengeServer,
} from "./acme/index.ts";

export type ResolvedHabitatTlsAcmeRuntime = {
  email: string;
  domains: string[];
  staging: boolean;
  challengePort: number;
  challengeServer: AcmeChallengeServer;
};

export type ResolvedHabitatTlsListenConfig = {
  enabled: true;
  port: number;
  material: HabitatTlsMaterial;
  /** mode=acme 时存在；challenge 服已启动，调用方负责续期调度与 stop */
  acme?: ResolvedHabitatTlsAcmeRuntime;
};

async function resolveOptionalConfigString(value: string | undefined): Promise<string | undefined> {
  if (value === undefined || value.trim() === "") return undefined;
  return resolveValue(value);
}

export async function resolveHabitatTlsListenConfig(
  http: HttpConfig | undefined,
  bindHosts: string[],
): Promise<ResolvedHabitatTlsListenConfig | null> {
  const tls: HttpTlsConfigFields | undefined = http?.tls ?? undefined;
  if (!tls?.enabled) return null;

  const mode = resolveHttpTlsMode(tls.mode);
  const certRaw = (await resolveOptionalConfigString(tls.cert)) ?? defaultHabitatTlsCertPath();
  const keyRaw = (await resolveOptionalConfigString(tls.key)) ?? defaultHabitatTlsKeyPath();
  const passphrase = await resolveOptionalConfigString(tls.passphrase);
  const httpsPort = tls.port ?? DEFAULT_HABITAT_TLS_PORT;

  if (mode === "acme") {
    const acmeCfg = tls.acme;
    if (!acmeCfg) {
      throw new Error("http.tls.mode=acme 时须配置 http.tls.acme");
    }
    const challengePort = acmeCfg.challenge_port ?? 80;
    const staging = acmeCfg.staging === true;
    const domains = acmeCfg.domains.map((d) => d.trim());
    const challengeServer = startAcmeChallengeServer({ port: challengePort });
    try {
      const material = await ensureAcmeMaterial({
        certPath: certRaw,
        keyPath: keyRaw,
        email: acmeCfg.email,
        domains,
        staging,
      });
      return {
        enabled: true,
        port: httpsPort,
        material: {
          ...material,
          ...(passphrase ? { passphrase } : {}),
        },
        acme: {
          email: acmeCfg.email,
          domains,
          staging,
          challengePort: challengeServer.port,
          challengeServer,
        },
      };
    } catch (err) {
      await challengeServer.close();
      throw err;
    }
  }

  const material = ensureHabitatTlsMaterial({
    certPath: certRaw,
    keyPath: keyRaw,
    mkcert: mode === "mkcert",
    bindHosts,
    allowedHosts: collectHttpAllowedHosts(http),
    ...(passphrase ? { passphrase } : {}),
  });

  return {
    enabled: true,
    port: httpsPort,
    material,
  };
}

export type HabitatTlsBunOptions = {
  key: ReturnType<typeof Bun.file>;
  cert: ReturnType<typeof Bun.file>;
  passphrase?: string;
};

export function toHabitatTlsBunOptions(material: HabitatTlsMaterial): HabitatTlsBunOptions {
  return omitUndefined({
    key: Bun.file(material.keyPath),
    cert: Bun.file(material.certPath),
    ...(material.passphrase ? { passphrase: material.passphrase } : {}),
  });
}

export { PATHS };
