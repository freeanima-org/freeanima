import { RedisClient } from "bun";
import { RedisEventQueue } from "@freeanima/host/capabilities/connectors/eventbus-redis";
import type { EventQueueAdapter } from "@freeanima/host/kernel/eventbus";
import type { Config } from "@freeanima/host/platform/config";
import {
  getConfiguredRedisUrlFromBootstrap,
  getEventbusKeyPrefix,
} from "@freeanima/host/platform/config";
import { loadBootstrapConfig } from "../config/bootstrap.ts";

let redisClientForTest: RedisClient | null = null;

/** Unit test inject mock Redis client */
export function setEventQueueOverridesForTest(opts: { redisClient?: RedisClient }): void {
  if (opts.redisClient !== undefined) redisClientForTest = opts.redisClient;
}

export function resetEventQueueOverridesForTest(): void {
  redisClientForTest = null;
}

/** Build EventBus queue adapter from runtime config（key_prefix）+ bootstrap redis */
export function createEventQueue(config: Config): EventQueueAdapter {
  const cfg = config.data;
  if (redisClientForTest) {
    return new RedisEventQueue(redisClientForTest, { keyPrefix: getEventbusKeyPrefix(cfg) });
  }
  const redisUrl = getConfiguredRedisUrlFromBootstrap(loadBootstrapConfig());
  return new RedisEventQueue(redisUrl, {
    keyPrefix: getEventbusKeyPrefix(cfg),
  });
}
