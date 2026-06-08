import { loadConfig } from "./config.ts";

export type RedisConfigInput = {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
};

/** 由分项配置构造 Redis URL（默认 127.0.0.1:6379/0） */
export function buildRedisUrl(config?: RedisConfigInput): string {
  if (config?.url) return config.url;
  const host = config?.host ?? "127.0.0.1";
  const port = config?.port ?? 6379;
  const db = config?.db ?? 0;
  const auth = config?.password ? `:${encodeURIComponent(config.password)}@` : "";
  return `redis://${auth}${host}:${port}/${db}`;
}

/** 从 config.yaml 解析 Redis URL；未写 redis 段时使用本地默认 */
export function getConfiguredRedisUrl(): string {
  const cfg = loadConfig();
  return buildRedisUrl(cfg.redis);
}
