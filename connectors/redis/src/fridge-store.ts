import type { FridgeStorePort } from "@freeanima/capabilities-fridge-magnet/fridge-store-port";
import { redisDel, redisGet, redisScanEntries, redisSet } from "./kv.ts";

/** 基于 connectors-redis 的 FridgeStorePort 实现 */
export function createRedisFridgeStore(): FridgeStorePort {
  return {
    set: redisSet,
    get: redisGet,
    delete: redisDel,
    scan: redisScanEntries,
  };
}
