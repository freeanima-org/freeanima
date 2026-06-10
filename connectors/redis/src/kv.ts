import { getRedis, isRedisConfigured } from "./client.ts";

export type RedisScanEntry = {
  key: string;
  value: string;
};

/** Write string key; use SETEX with TTL. Silently skip when Redis unavailable. */
export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const redis = getRedis();
    if (ttlSeconds != null) {
      await redis.setex(key, ttlSeconds, value);
      return;
    }
    await redis.set(key, value);
  } catch {
    /* Silently skip when Redis unavailable */
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

/** Delete key; silently skip when unavailable. */
export async function redisDel(key: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await getRedis().del(key);
  } catch {
    /* Silently skip when Redis unavailable */
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
