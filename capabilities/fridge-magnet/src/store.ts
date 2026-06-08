import { randomBytes } from "node:crypto";
import Redis from "ioredis";
import type { FridgeMagnetScanHit, FridgeMagnetRedisConfig } from "./types.ts";

let redis: Redis | null = null;

const MAX_TTL = 86400;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function initRedis(config: FridgeMagnetRedisConfig = {}): void {
  if (redis) return;
  redis = new Redis({
    host: config.host ?? "127.0.0.1",
    port: config.port ?? 6379,
    password: config.password,
    db: config.db ?? 0,
    lazyConnect: true,
  });
}

export function getRedis(): Redis {
  if (!redis) throw new Error("Redis 未初始化，请先调用 initRedis()");
  return redis;
}

/** 测试重置 */
export function resetRedisForTests(): void {
  redis = null;
}

export function magnetRedisKey(module: string, id: string): string {
  return `fridge:${module}:${id}`;
}

export function randomBase62(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BASE62[bytes[i]! % BASE62.length];
  }
  return out;
}

export function clampTtl(ttl?: number): number {
  const n = ttl ?? MAX_TTL;
  return Math.max(1, Math.min(n, MAX_TTL));
}

function safeRedis(): Redis | null {
  try {
    return getRedis();
  } catch {
    return null;
  }
}

export async function setMagnet(
  module: string,
  id: string,
  value: string,
  ttl?: number,
): Promise<void> {
  const r = safeRedis();
  if (!r) return;
  const key = magnetRedisKey(module, id);
  const effectiveTtl = clampTtl(ttl);
  try {
    await r.set(key, value, "EX", effectiveTtl);
  } catch {
    /* Redis 不可用时静默跳过 */
  }
}

export async function getMagnet(module: string, id: string): Promise<string | null> {
  const r = safeRedis();
  if (!r) return null;
  const key = magnetRedisKey(module, id);
  try {
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function deleteMagnet(module: string, id: string): Promise<void> {
  const r = safeRedis();
  if (!r) return;
  const key = magnetRedisKey(module, id);
  try {
    await r.del(key);
  } catch {
    /* Redis 不可用时静默跳过 */
  }
}

export async function scanMagnets(pattern: string): Promise<FridgeMagnetScanHit[]> {
  const r = safeRedis();
  if (!r) return [];
  const results: FridgeMagnetScanHit[] = [];
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await r.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      for (const key of keys) {
        const value = await r.get(key);
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
