import type { AnimaConfig } from "@freeanima/storage-config";

export type EventbusBackend = "redis";

const DEFAULT_KEY_PREFIX = "anima:events";

/** Read EventBus backend from config; default redis */
export function getEventbusBackend(cfg: AnimaConfig): EventbusBackend {
  return cfg.eventbus?.backend ?? "redis";
}

/** EventBus Redis key prefix; default anima:events */
export function getEventbusKeyPrefix(cfg: AnimaConfig): string {
  return cfg.eventbus?.key_prefix ?? DEFAULT_KEY_PREFIX;
}
