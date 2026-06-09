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

/** 按 config.yaml 构造 EventBus 队列适配器 */
export function createEventQueue(): EventQueueAdapter {
  const backend = getEventbusBackend();
  if (backend === "redis") {
    const cfg = loadConfig();
    return new RedisEventQueue(buildRedisUrl(cfg.redis), { keyPrefix: getEventbusKeyPrefix() });
  }
  return new SqliteEventQueue(PATHS.eventsDb);
}
