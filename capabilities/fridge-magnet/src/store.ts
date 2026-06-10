import { randomInt } from "node:crypto";
import { getFridgeStore } from "./fridge-store-port.ts";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function magnetRedisKey(module: string, id: string): string {
  return `fridge:${module}:${id}`;
}

export function randomBase62(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BASE62[randomInt(BASE62.length)];
  }
  return out;
}

export function clampTtl(ttl?: number): number {
  const MAX_TTL = 86400;
  const n = ttl ?? MAX_TTL;
  return Math.max(1, Math.min(n, MAX_TTL));
}

export async function setMagnet(
  module: string,
  id: string,
  value: string,
  ttl?: number,
): Promise<void> {
  await getFridgeStore().set(magnetRedisKey(module, id), value, clampTtl(ttl));
}

export async function getMagnet(module: string, id: string): Promise<string | null> {
  return getFridgeStore().get(magnetRedisKey(module, id));
}

export async function deleteMagnet(module: string, id: string): Promise<void> {
  await getFridgeStore().delete(magnetRedisKey(module, id));
}

export async function scanMagnets(pattern: string) {
  return getFridgeStore().scan(pattern);
}
