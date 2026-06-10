import { getRedis, isRedisConfigured } from "./client.ts";

export type RedisScanEntry = {
  key: string;
  value: string;
};

/** 写入字符串键；带 TTL 时用 SETEX。Redis 不可用时静默跳过。 */
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
    /* Redis 不可用时静默跳过 */
  }
}

/** 读取字符串键；不可用时返回 null。 */
export async function redisGet(key: string): Promise<string | null> {
  if (!isRedisConfigured()) return null;
  try {
    return await getRedis().get(key);
  } catch {
    return null;
  }
}

/** 删除键；不可用时静默跳过。 */
export async function redisDel(key: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await getRedis().del(key);
  } catch {
    /* Redis 不可用时静默跳过 */
  }
}

/** 读取键剩余 TTL（秒）；不可用时返回 null。语义对齐 Redis TTL 命令。 */
export async function redisTtl(key: string): Promise<number | null> {
  if (!isRedisConfigured()) return null;
  try {
    return await getRedis().ttl(key);
  } catch {
    return null;
  }
}

/** SCAN 匹配键并批量取值；不可用时返回空数组。 */
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
