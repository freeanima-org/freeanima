import { redisGet, redisSet } from "./kv.ts";

/**
 * 薄缓存层（可丢弃）：强制 TTL、miss→null、Redis 不可用时用进程内存旁路。
 * 与 `kv.ts` 持久 KV 分离——权威状态勿走此层。
 */

/** Key 前缀约定：可丢弃缓存 */
export const REDIS_CACHE_KEY_PREFIX = "anima:cache:";

type MemoryEntry = {
  value: string;
  expiresAtMs: number;
};

const memoryCache = new Map<string, MemoryEntry>();

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAtMs) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  memoryCache.set(key, {
    value,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  });
}

/** 测试用：清空进程内旁路 */
export function resetCacheMemoryForTests(): void {
  memoryCache.clear();
}

/**
 * 读缓存字符串。优先 Redis；miss 或不可用时再看进程内存。
 */
export async function cacheGet(key: string): Promise<string | null> {
  const fromRedis = await redisGet(key);
  if (fromRedis != null) return fromRedis;
  return memoryGet(key);
}

/**
 * 写缓存字符串（必须带 TTL）。写 Redis；无论成败都写内存旁路，保证同进程命中。
 */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!(ttlSeconds > 0)) {
    throw new Error("cacheSet requires ttlSeconds > 0");
  }
  await redisSet(key, value, ttlSeconds);
  memorySet(key, value, ttlSeconds);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
}
