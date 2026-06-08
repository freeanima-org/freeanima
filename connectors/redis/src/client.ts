import { RedisClient } from "bun";

export type RedisUrlResolver = () => string | null;

export type RedisConnectionConfig = {
  url: string;
};

let redisUrlResolver: RedisUrlResolver | null = null;
let client: RedisClient | null = null;

/** 由 service 组合根注入 Redis URL 解析（启动时调用一次） */
export function initRedis(opts: { getRedisUrl: RedisUrlResolver }): void {
  redisUrlResolver = opts.getRedisUrl;
}

export function getRedisConfig(): RedisConnectionConfig | null {
  const url = redisUrlResolver?.() ?? null;
  if (!url) return null;
  return { url };
}

export function isRedisConfigured(): boolean {
  return getRedisConfig() != null;
}

function createClient(url: string): RedisClient {
  return new RedisClient(url);
}

export function getRedis(): RedisClient {
  if (client) return client;
  const cfg = getRedisConfig();
  if (!cfg?.url) {
    throw new Error("Redis 未配置");
  }
  client = createClient(cfg.url);
  return client;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  client.close();
  client = null;
}

/** 测试注入 mock 客户端 */
export function setRedisForTest(mock: RedisClient): void {
  client = mock;
}

/** 测试 teardown：重置 resolver 与连接 */
export function resetRedisForTest(): void {
  redisUrlResolver = null;
  client = null;
}
