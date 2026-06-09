import { loadConfig } from "./config.ts";

export type EventbusBackend = "sqlite" | "redis";

const DEFAULT_KEY_PREFIX = "anima:events";

/** 从 config.yaml 读取 EventBus 后端；默认 sqlite */
export function getEventbusBackend(): EventbusBackend {
  return loadConfig().eventbus?.backend ?? "sqlite";
}

/** EventBus Redis 键前缀；默认 anima:events */
export function getEventbusKeyPrefix(): string {
  return loadConfig().eventbus?.key_prefix ?? DEFAULT_KEY_PREFIX;
}
