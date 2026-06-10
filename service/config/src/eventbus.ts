import { loadConfig } from "./config.ts";

export type EventbusBackend = "sqlite" | "redis";

const DEFAULT_KEY_PREFIX = "anima:events";

/** Read EventBus backend from config.yaml; default sqlite */
export function getEventbusBackend(): EventbusBackend {
  return loadConfig().eventbus?.backend ?? "sqlite";
}

/** EventBus Redis key prefix; default anima:events */
export function getEventbusKeyPrefix(): string {
  return loadConfig().eventbus?.key_prefix ?? DEFAULT_KEY_PREFIX;
}
