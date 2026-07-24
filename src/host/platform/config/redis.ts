import { omitUndefined } from "@freeanima/host/core/util";
import type { BootstrapConfig } from "@freeanima/host/core/config";

type RedisConfigInput = {
  url?: string;
  host?: string;
  port?: number;
  db?: number;
  password?: string;
};

export function buildRedisUrl(config?: RedisConfigInput): string {
  if (config?.url) return config.url;
  const host = config?.host ?? "127.0.0.1";
  const port = config?.port ?? 6379;
  const db = config?.db ?? 0;
  const auth = config?.password ? `:${encodeURIComponent(config.password)}@` : "";
  return `redis://${auth}${host}:${port}/${db}`;
}

export function getConfiguredRedisUrlFromBootstrap(bootstrap: BootstrapConfig): string {
  return buildRedisUrl(bootstrap.redis ? omitUndefined(bootstrap.redis) : undefined);
}
