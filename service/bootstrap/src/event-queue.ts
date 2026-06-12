import { RedisClient } from "bun";
import { RedisEventQueue } from "@freeanima/connectors-eventbus-redis";
import type { EventQueueAdapter } from "@freeanima/kernel/eventbus";
import type { Config } from "@freeanima/service-config";
import { buildRedisUrl, getEventbusKeyPrefix } from "@freeanima/service-config";

let redisClientForTest: RedisClient | null = null;

/** Unit test inject mock Redis client */
export function setEventQueueOverridesForTest(opts: { redisClient?: RedisClient }): void {
  if (opts.redisClient !== undefined) redisClientForTest = opts.redisClient;
}

export function resetEventQueueOverridesForTest(): void {
  redisClientForTest = null;
}

/** Build EventBus queue adapter from injected config */
export function createEventQueue(config: Config): EventQueueAdapter {
  const cfg = config.data;
  if (redisClientForTest) {
    return new RedisEventQueue(redisClientForTest, { keyPrefix: getEventbusKeyPrefix(cfg) });
  }
  return new RedisEventQueue(buildRedisUrl(cfg.redis), { keyPrefix: getEventbusKeyPrefix(cfg) });
}
