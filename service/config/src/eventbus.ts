import { loadConfig } from "./config.ts";

export type EventbusBackend = "redis";

const DEFAULT_KEY_PREFIX = "anima:events";

/** Read EventBus backend from config.yaml; default redis */
export function getEventbusBackend(): EventbusBackend {
  return loadConfig().eventbus?.backend ?? "redis";
}

/** EventBus Redis key prefix; default anima:events */
export function getEventbusKeyPrefix(): string {
  return loadConfig().eventbus?.key_prefix ?? DEFAULT_KEY_PREFIX;
}
