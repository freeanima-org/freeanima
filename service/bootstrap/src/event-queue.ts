import { RedisClient } from "bun";
import { SqliteEventQueue } from "@freeanima/connectors-eventbus-sqlite";
import { RedisEventQueue } from "@freeanima/connectors-eventbus-redis";
import type { EventQueueAdapter } from "@freeanima/kernel-eventbus";
import {
  PATHS,
  buildRedisUrl,
  getEventbusBackend,
  getEventbusKeyPrefix,
  loadConfig,
} from "@freeanima/service-config";

let sqliteDbPathForTest: string | null = null;
let redisClientForTest: RedisClient | null = null;

/** Unit test inject in-memory SQLite path or mock Redis client */
export function setEventQueueOverridesForTest(opts: {
  sqliteDbPath?: string;
  redisClient?: RedisClient;
}): void {
  if (opts.sqliteDbPath !== undefined) sqliteDbPathForTest = opts.sqliteDbPath;
  if (opts.redisClient !== undefined) redisClientForTest = opts.redisClient;
}

export function resetEventQueueOverridesForTest(): void {
  sqliteDbPathForTest = null;
  redisClientForTest = null;
}

/** Build EventBus queue adapter per config.yaml */
export function createEventQueue(): EventQueueAdapter {
  const backend = getEventbusBackend();
  if (backend === "redis") {
    const cfg = loadConfig();
    if (redisClientForTest) {
      return new RedisEventQueue(redisClientForTest, { keyPrefix: getEventbusKeyPrefix() });
    }
    return new RedisEventQueue(buildRedisUrl(cfg.redis), { keyPrefix: getEventbusKeyPrefix() });
  }
  return new SqliteEventQueue(sqliteDbPathForTest ?? PATHS.eventsDb);
}
