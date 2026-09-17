import type { RedisClient } from "bun";

import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import { mountRedisService } from "./service.ts";
import type { RedisConnectionConfig, RedisUrlResolver } from "./service.ts";

export type { RedisConnectionConfig, RedisUrlResolver };

/** Redis URL resolver injected by service composition root (called once at startup) */
export function initRedis(opts: { getRedisUrl: RedisUrlResolver }): void {
  mountRedisService(ensureRootContext(), opts.getRedisUrl);
}

export function getRedisConfig(): RedisConnectionConfig | null {
  return getRootContextOrNull()?.redis?.getConfig() ?? null;
}

export function isRedisConfigured(): boolean {
  return getRootContextOrNull()?.redis?.isConfigured() ?? false;
}

export function getRedis(): RedisClient {
  const service = getRootContextOrNull()?.redis;
  if (!service) {
    throw new Error("Redis not configured");
  }
  return service.getClient();
}

export async function closeRedis(): Promise<void> {
  await getRootContextOrNull()?.redis?.close();
}

/** Inject mock client for tests */
export function setRedisForTest(mock: RedisClient): void {
  mountRedisService(ensureRootContext()).setClient(mock);
}

/** Test teardown: reset resolver and connection */
export function resetRedisForTest(): void {
  getRootContextOrNull()?.redis?.reset();
}
