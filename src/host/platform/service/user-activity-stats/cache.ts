import { REDIS_CACHE_KEY_PREFIX, cacheGetJson, cacheSetJson } from "@freeanima/host/core/redis";
import type { UserActivityStats } from "@freeanima/host/core/db/pg/conversation";
import {
  buildUserActivityWindows,
  secondsUntilNextCstMidnight,
  type ActivityWindowDef,
} from "./windows.ts";

export const USER_ACTIVITY_STATS_CACHE_KEY = `${REDIS_CACHE_KEY_PREFIX}user-activity-stats`;

export type UserActivityStatsCachePayload = {
  as_of_day: string;
  windows: ActivityWindowDef[];
  stats: UserActivityStats;
};

export async function loadUserActivityStatsCache(
  asOfDay: string,
): Promise<UserActivityStatsCachePayload | null> {
  const hit = await cacheGetJson<UserActivityStatsCachePayload>(USER_ACTIVITY_STATS_CACHE_KEY);
  if (hit == null) return null;
  if (hit.as_of_day !== asOfDay) return null;
  if (!hit.stats || !Array.isArray(hit.windows)) return null;
  return hit;
}

export async function saveUserActivityStatsCache(
  payload: UserActivityStatsCachePayload,
  nowMs: number = Date.now(),
): Promise<void> {
  const ttl = secondsUntilNextCstMidnight(nowMs);
  await cacheSetJson(USER_ACTIVITY_STATS_CACHE_KEY, payload, ttl);
}

export function currentUserActivityAsOfDay(nowMs: number = Date.now()): string {
  return buildUserActivityWindows(nowMs).as_of_day;
}
