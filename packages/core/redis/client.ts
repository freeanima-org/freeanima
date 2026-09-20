import { RedisClient } from "bun";

export type RedisUrlResolver = () => string | null;

export type RedisConnectionConfig = {
  url: string;
};

type RedisState = {
  urlResolver: RedisUrlResolver | null;
  client: RedisClient | null;
};

let state: RedisState = { urlResolver: null, client: null };

function isRedisConnectionClosedError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code: unknown }).code === "ERR_REDIS_CONNECTION_CLOSED"
  );
}

function getConfig(): RedisConnectionConfig | null {
  const url = state.urlResolver?.() ?? null;
  return url ? { url } : null;
}

/** Redis URL resolver injected by service composition root (called once at startup) */
export function initRedis(opts: { getRedisUrl: RedisUrlResolver }): void {
  state = { urlResolver: opts.getRedisUrl, client: null };
}

export function getRedisConfig(): RedisConnectionConfig | null {
  return getConfig();
}

export function isRedisConfigured(): boolean {
  return getConfig() != null;
}

export function getRedis(): RedisClient {
  if (state.client) return state.client;
  const cfg = getConfig();
  if (!cfg?.url) {
    throw new Error("Redis not configured");
  }
  state.client = new RedisClient(cfg.url);
  return state.client;
}

export async function closeRedis(): Promise<void> {
  const client = state.client;
  if (!client) return;
  try {
    client.close();
  } catch (err) {
    if (!isRedisConnectionClosedError(err)) throw err;
  }
  state.client = null;
}

/** Inject mock client for tests */
export function setRedisForTest(mock: RedisClient): void {
  state.client = mock;
}

/** Test teardown: reset resolver and connection */
export function resetRedisForTest(): void {
  state = { urlResolver: null, client: null };
}
