import Redis from "ioredis";
import type { FridgeMagnet, FridgeMagnetRedisConfig } from "./types.ts";

let redis: Redis | null = null;

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

const MAX_TTL = 86400; // 24 小时

function magnetKey(sessionId: string): string {
  return `fridge:${sessionId}`;
}

export async function scanSessionMagnets(sessionId: string): Promise<FridgeMagnet[]> {
  const r = getRedis();
  const data = await r.hgetall(magnetKey(sessionId));
  const list: FridgeMagnet[] = [];
  for (const [key, value] of Object.entries(data)) {
    list.push({ key, value });
  }
  return list;
}

export async function writeFridgeMagnet(
  sessionId: string,
  key: string,
  value: string,
  ttl: number = MAX_TTL,
): Promise<void> {
  const r = getRedis();
  const mk = magnetKey(sessionId);
  const effectiveTtl = Math.max(1, Math.min(ttl, MAX_TTL));
  await r.hset(mk, key, value);
  await r.expire(mk, effectiveTtl);
}
