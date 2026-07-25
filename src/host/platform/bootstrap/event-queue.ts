import { RedisClient } from "bun";
import { RedisEventQueue } from "@freeanima/host/capabilities/connectors/eventbus-redis";
import { omitUndefined } from "@freeanima/host/core/util";
import type { EventQueueAdapter } from "@freeanima/host/kernel/eventbus";
import type { Config } from "@freeanima/host/platform/config";
import { buildRedisUrl, getEventbusKeyPrefix } from "@freeanima/host/platform/config";
import { loadConfigYamlRecord } from "../config/yaml-io.ts";

let redisClientForTest: RedisClient | null = null;

/** Unit test inject mock Redis client */
export function setEventQueueOverridesForTest(opts: { redisClient?: RedisClient }): void {
  if (opts.redisClient !== undefined) redisClientForTest = opts.redisClient;
}

export function resetEventQueueOverridesForTest(): void {
  redisClientForTest = null;
}

function redisUrlFromYaml(): string {
  const redis = loadConfigYamlRecord().redis;
  if (typeof redis !== "object" || redis == null || Array.isArray(redis)) {
    return buildRedisUrl();
  }
  const r = redis as Record<string, unknown>;
  return buildRedisUrl(
    omitUndefined({
      url: typeof r.url === "string" ? r.url : undefined,
      host: typeof r.host === "string" ? r.host : undefined,
      port: typeof r.port === "number" ? r.port : undefined,
      password: typeof r.password === "string" ? r.password : undefined,
      db: typeof r.db === "number" ? r.db : undefined,
    }),
  );
}

/** Build EventBus queue adapter from runtime config（key_prefix）+ yaml redis（不要求 database） */
export function createEventQueue(config: Config): EventQueueAdapter {
  const cfg = config.data;
  if (redisClientForTest) {
    return new RedisEventQueue(redisClientForTest, { keyPrefix: getEventbusKeyPrefix(cfg) });
  }
  return new RedisEventQueue(redisUrlFromYaml(), {
    keyPrefix: getEventbusKeyPrefix(cfg),
  });
}
