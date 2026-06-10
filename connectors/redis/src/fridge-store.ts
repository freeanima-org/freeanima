import type { FridgeStorePort } from "@freeanima/capabilities-fridge-magnet/fridge-store-port";
import { redisDel, redisGet, redisScanEntries, redisSet } from "./kv.ts";

/** FridgeStorePort implementation based on connectors-redis */
export function createRedisFridgeStore(): FridgeStorePort {
  return {
    set: redisSet,
    get: redisGet,
    delete: redisDel,
    scan: redisScanEntries,
  };
}
