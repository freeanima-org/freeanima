import { RedisClient } from "bun";

export type RedisUrlResolver = () => string | null;

export type RedisConnectionConfig = {
  url: string;
};

let redisUrlResolver: RedisUrlResolver | null = null;
let client: RedisClient | null = null;

/** Redis URL resolver injected by service composition root (called once at startup) */
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
    throw new Error("Redis not configured");
  }
  client = createClient(cfg.url);
  return client;
}

function isRedisConnectionClosedError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code: unknown }).code === "ERR_REDIS_CONNECTION_CLOSED"
  );
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    client.close();
  } catch (err) {
    if (!isRedisConnectionClosedError(err)) throw err;
  }
  client = null;
}

/** Inject mock client for tests */
export function setRedisForTest(mock: RedisClient): void {
  client = mock;
}

/** Test teardown: reset resolver and connection */
export function resetRedisForTest(): void {
  redisUrlResolver = null;
  client = null;
}
