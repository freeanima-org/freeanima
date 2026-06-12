import type { AnimaConfig } from "@freeanima/core/config";

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

/** Parse Redis URL from config; local default when redis section omitted */
export function getConfiguredRedisUrl(cfg: AnimaConfig): string {
  return buildRedisUrl(cfg.redis);
}
