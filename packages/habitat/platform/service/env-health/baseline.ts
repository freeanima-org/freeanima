import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { homePath } from "@freeanima/habitat/core/config/paths";
import {
  isRedisConfigured,
  REDIS_KV_KEY_PREFIX,
  redisGetJson,
  redisSetJson,
} from "@freeanima/habitat/core/redis";
import type { EnvHealthMarkers } from "./types.ts";
import { asRecord } from "@freeanima/shared/util";

export const ENV_HEALTH_BASELINE_FILENAME = "env-health-baseline.json";
export const ENV_HEALTH_BASELINE_KV_KEY = `${REDIS_KV_KEY_PREFIX}env-health-baseline`;

export type EnvHealthBaselineStore = {
  load(): Promise<EnvHealthMarkers | null>;
  save(markers: EnvHealthMarkers): Promise<void>;
};

let memoryCache: EnvHealthMarkers | null | undefined;

export function baselineFilePath(): string {
  return homePath(ENV_HEALTH_BASELINE_FILENAME);
}

function isMarkers(value: unknown): value is EnvHealthMarkers {
  const o = asRecord(value);
  if (!o) return false;
  return (
    typeof o.hostname === "string" &&
    typeof o.os === "string" &&
    typeof o.timezone === "string" &&
    typeof o.hub_version === "string" &&
    typeof o.boot_started_at === "string" &&
    typeof o.postgres === "string" &&
    typeof o.redis === "string" &&
    typeof o.rss_band === "string" &&
    typeof o.mcp_connected === "number" &&
    typeof o.mcp_servers === "number" &&
    typeof o.acp_connected === "number" &&
    typeof o.acp_agents === "number" &&
    typeof o.disk_free_band === "string"
  );
}

function readMarkersFromFile(path: string): EnvHealthMarkers | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    return isMarkers(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeMarkersToFile(path: string, markers: EnvHealthMarkers): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(markers, null, 2)}\n`, "utf-8");
}

function tryUnlinkFile(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* ignore */
  }
}

/**
 * Redis KV 优先；未配置或写失败时回退文件作权威。
 * 首次从 Redis miss 且文件存在时迁移到 Redis 并删文件。
 */
export function createBaselineStore(filePath: string = baselineFilePath()): EnvHealthBaselineStore {
  return {
    async load() {
      if (memoryCache !== undefined) return memoryCache;

      if (isRedisConfigured()) {
        const fromRedis = await redisGetJson<EnvHealthMarkers>(ENV_HEALTH_BASELINE_KV_KEY);
        if (fromRedis != null && isMarkers(fromRedis)) {
          memoryCache = fromRedis;
          return fromRedis;
        }
        const fromFile = readMarkersFromFile(filePath);
        if (fromFile != null) {
          const ok = await redisSetJson(ENV_HEALTH_BASELINE_KV_KEY, fromFile);
          if (ok) tryUnlinkFile(filePath);
          memoryCache = fromFile;
          return fromFile;
        }
        memoryCache = null;
        return null;
      }

      const fromFile = readMarkersFromFile(filePath);
      memoryCache = fromFile;
      return fromFile;
    },

    async save(markers) {
      memoryCache = markers;
      if (isRedisConfigured()) {
        const ok = await redisSetJson(ENV_HEALTH_BASELINE_KV_KEY, markers);
        if (ok) {
          tryUnlinkFile(filePath);
          return;
        }
      }
      writeMarkersToFile(filePath, markers);
    },
  };
}

/** @deprecated 名称保留；实现已改为 Redis KV + 文件回退 */
export function createFileBaselineStore(path: string = baselineFilePath()): EnvHealthBaselineStore {
  return createBaselineStore(path);
}

/** 测试用：清空进程内缓存 */
export function resetBaselineMemoryCacheForTests(): void {
  memoryCache = undefined;
}

let defaultStore: EnvHealthBaselineStore | null = null;

export function getBaselineStore(): EnvHealthBaselineStore {
  if (!defaultStore) defaultStore = createBaselineStore();
  return defaultStore;
}

/** 测试注入 */
export function setBaselineStoreForTests(store: EnvHealthBaselineStore | null): void {
  defaultStore = store;
  memoryCache = undefined;
}
