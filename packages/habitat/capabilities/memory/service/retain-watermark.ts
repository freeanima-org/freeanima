/**
 * retain watermark（#16102）。
 * 不建 memory_retain_queue；丢失可从 semantic provenance 重建（仅导致多跑 retain）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { homePath } from "@freeanima/habitat/core/config/paths";
import {
  isRedisConfigured,
  REDIS_KV_KEY_PREFIX,
  redisGetJson,
  redisSetJson,
} from "@freeanima/habitat/core/redis";

export type RetainWatermark = {
  message_id: string;
  at: string;
};

export function retainWatermarkKvKey(conversationId: string): string {
  return `${REDIS_KV_KEY_PREFIX}memory-retain:${conversationId}`;
}

export function retainWatermarkFilePath(): string {
  return homePath("runtime", "memory-retain-watermarks.json");
}

type FileStore = Record<string, RetainWatermark>;

function readFileStore(path: string): FileStore {
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (raw == null || typeof raw !== "object") return {};
    return raw as FileStore;
  } catch {
    return {};
  }
}

function writeFileStore(path: string, store: FileStore): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

export type RetainWatermarkStore = {
  get(conversationId: string): Promise<RetainWatermark | null>;
  set(conversationId: string, watermark: RetainWatermark): Promise<void>;
};

/** Redis 优先；失败回退 runtime JSON 文件 */
export function createRetainWatermarkStore(
  filePath: string = retainWatermarkFilePath(),
): RetainWatermarkStore {
  return {
    async get(conversationId) {
      if (isRedisConfigured()) {
        const fromRedis = await redisGetJson<RetainWatermark>(retainWatermarkKvKey(conversationId));
        if (fromRedis?.message_id) return fromRedis;
      }
      const store = readFileStore(filePath);
      return store[conversationId] ?? null;
    },
    async set(conversationId, watermark) {
      const wrote = isRedisConfigured()
        ? await redisSetJson(retainWatermarkKvKey(conversationId), watermark)
        : false;
      if (wrote) return;
      const store = readFileStore(filePath);
      store[conversationId] = watermark;
      writeFileStore(filePath, store);
    },
  };
}

const defaultStore = createRetainWatermarkStore();

export async function getRetainWatermark(conversationId: string): Promise<RetainWatermark | null> {
  return defaultStore.get(conversationId);
}

export async function setRetainWatermark(
  conversationId: string,
  watermark: RetainWatermark,
): Promise<void> {
  return defaultStore.set(conversationId, watermark);
}
