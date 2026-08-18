import {
  forceReleaseRedisLock,
  isRedisConfigured,
  listRedisLocks,
} from "@freeanima/habitat/core/redis";

import { ApiHandlerError } from "./errors.ts";

export async function listHabitatRedisLocks() {
  return {
    configured: isRedisConfigured(),
    locks: await listRedisLocks(),
  };
}

export async function deleteHabitatRedisLock(body: { key: string }) {
  const key = body.key.trim();
  if (!key) {
    throw new ApiHandlerError(400, "key is required", { code: "redis_lock_key_required" });
  }
  if (!isRedisConfigured()) {
    throw new ApiHandlerError(503, "Redis 未配置", { code: "redis_unconfigured" });
  }
  const deleted = await forceReleaseRedisLock(key);
  return { deleted };
}
