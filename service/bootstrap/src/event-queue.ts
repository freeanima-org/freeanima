import { RedisClient } from "bun";
import { RedisEventQueue } from "@freeanima/connectors-eventbus-redis";
import type { EventQueueAdapter } from "@freeanima/kernel-eventbus";
import { buildRedisUrl, getEventbusKeyPrefix, loadConfig } from "@freeanima/service-config";

let redisClientForTest: RedisClient | null = null;

/** Unit test inject mock Redis client */
export function setEventQueueOverridesForTest(opts: { redisClient?: RedisClient }): void {
  if (opts.redisClient !== undefined) redisClientForTest = opts.redisClient;
}

export function resetEventQueueOverridesForTest(): void {
  redisClientForTest = null;
}

/** Build EventBus queue adapter per config.yaml */
export function createEventQueue(): EventQueueAdapter {
  const cfg = loadConfig();
  if (redisClientForTest) {
    return new RedisEventQueue(redisClientForTest, { keyPrefix: getEventbusKeyPrefix() });
  }
  return new RedisEventQueue(buildRedisUrl(cfg.redis), { keyPrefix: getEventbusKeyPrefix() });
}
