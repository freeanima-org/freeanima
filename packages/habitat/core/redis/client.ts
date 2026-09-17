import type { RedisClient } from "bun";

import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import { mountRedisService } from "./service.ts";
import type { RedisConnectionConfig, RedisUrlResolver } from "./service.ts";

export type { RedisConnectionConfig, RedisUrlResolver };

/** Redis URL resolver injected by service composition root (called once at startup) */
export function initRedis(opts: { getRedisUrl: RedisUrlResolver }): void {
  mountRedisService(ensureProcessContext(), opts.getRedisUrl);
}

export function getRedisConfig(): RedisConnectionConfig | null {
  return getProcessContext()?.redis?.getConfig() ?? null;
}

export function isRedisConfigured(): boolean {
  return getProcessContext()?.redis?.isConfigured() ?? false;
}

export function getRedis(): RedisClient {
  const service = getProcessContext()?.redis;
  if (!service) {
    throw new Error("Redis not configured");
  }
  return service.getClient();
}

export async function closeRedis(): Promise<void> {
  await getProcessContext()?.redis?.close();
}

/** Inject mock client for tests */
export function setRedisForTest(mock: RedisClient): void {
  mountRedisService(ensureProcessContext()).setClient(mock);
}

/** Test teardown: reset resolver and connection */
export function resetRedisForTest(): void {
  getProcessContext()?.redis?.reset();
}
