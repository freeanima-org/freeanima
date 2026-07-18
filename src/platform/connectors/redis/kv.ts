import { getRedis, isRedisConfigured } from "./client.ts";

/**
 * Redis 字符串 KV（持久/权威状态用）。
 * 可选 `ttlSeconds` 是 Redis SETEX 能力，**不等于**产品「缓存层」——带 TTL 的旁路请用 `cache.ts`。
 * 未配置或失败时读返回 null、写返回 false；权威写调用方须自行回退文件等。
 */

export type RedisScanEntry = {
  key: string;
  value: string;
};

/** Key 前缀约定：持久 KV */
export const REDIS_KV_KEY_PREFIX = "anima:kv:";

/** Write string key. Optional TTL uses SETEX. Returns whether the write reached Redis. */
export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  try {
    const redis = getRedis();
    if (ttlSeconds != null) {
      await redis.setex(key, ttlSeconds, value);
      return true;
    }
    await redis.set(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Read string key; returns null when unavailable. */
export async function redisGet(key: string): Promise<string | null> {
  if (!isRedisConfigured()) return null;
  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

/** Delete key; returns whether delete was attempted on a live client. */
export async function redisDel(key: string): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  try {
    await getRedis().del(key);
    return true;
  } catch {
    return false;
  }
}

/** Read key remaining TTL (seconds); returns null when unavailable. Matches Redis TTL semantics. */
export async function redisTtl(key: string): Promise<number | null> {
  if (!isRedisConfigured()) return null;
  try {
    return await getRedis().ttl(key);
  } catch {
    return null;
  }
}

/** SCAN matching keys and batch get values; returns empty array when unavailable. */
export async function redisScanEntries(pattern: string, count = 100): Promise<RedisScanEntry[]> {
  if (!isRedisConfigured()) return [];
  const results: RedisScanEntry[] = [];
  try {
    const redis = getRedis();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", count);
      cursor = nextCursor;
      for (const key of keys) {
        const value = await redis.get(key);
        if (value != null) {
          results.push({ key, value });
        }
      }
    } while (cursor !== "0");
  } catch {
    return [];
  }
  return results;
}

/** JSON get via KV; null on miss / parse error / Redis unavailable. */
export async function redisGetJson<T>(key: string): Promise<T | null> {
  const raw = await redisGet(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** JSON set via KV (no TTL). Returns whether write reached Redis. */
export async function redisSetJson(key: string, value: unknown): Promise<boolean> {
  return redisSet(key, JSON.stringify(value));
}
