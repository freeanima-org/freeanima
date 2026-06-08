import { randomBytes } from "node:crypto";
import { redisDel, redisGet, redisScanEntries, redisSet } from "@freeanima/connectors-redis";
import type { FridgeMagnetScanHit } from "./types.ts";

const MAX_TTL = 86400;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

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

export async function setMagnet(
  module: string,
  id: string,
  value: string,
  ttl?: number,
): Promise<void> {
  await redisSet(magnetRedisKey(module, id), value, clampTtl(ttl));
}

export async function getMagnet(module: string, id: string): Promise<string | null> {
  return redisGet(magnetRedisKey(module, id));
}

export async function deleteMagnet(module: string, id: string): Promise<void> {
  await redisDel(magnetRedisKey(module, id));
}

export async function scanMagnets(pattern: string): Promise<FridgeMagnetScanHit[]> {
  return redisScanEntries(pattern);
}
