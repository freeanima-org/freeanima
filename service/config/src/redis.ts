import { loadConfig } from "./config.ts";

export type RedisConfigInput = {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
};

/** Build Redis URL from field config (default 127.0.0.1:6379/0) */
export function buildRedisUrl(config?: RedisConfigInput): string {
  if (config?.url) return config.url;
  const host = config?.host ?? "127.0.0.1";
  const port = config?.port ?? 6379;
  const db = config?.db ?? 0;
  const auth = config?.password ? `:${encodeURIComponent(config.password)}@` : "";
  return `redis://${auth}${host}:${port}/${db}`;
}

/** Parse Redis URL from config.yaml; local default when redis section omitted */
export function getConfiguredRedisUrl(): string {
  const cfg = loadConfig();
  return buildRedisUrl(cfg.redis);
}
