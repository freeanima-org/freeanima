import {
  type BuiltinCalendarItem,
  type BuiltinCalendarSourceId,
  BUILTIN_CALENDAR_SOURCE_IDS,
  expandBuiltinSourceYear,
} from "@freeanima/shared/util/builtin-calendar-sources.ts";
import { REDIS_CACHE_KEY_PREFIX, cacheGetJson, cacheSetJson } from "@freeanima/habitat/core/redis";

const TTL_SECONDS = 120 * 24 * 60 * 60; // 120 天

export function builtinCalendarYearCacheKey(source: BuiltinCalendarSourceId, year: number): string {
  return `${REDIS_CACHE_KEY_PREFIX}calendar:builtin:${source}:${year}`;
}

function isBuiltinItemArray(v: unknown): v is BuiltinCalendarItem[] {
  if (!Array.isArray(v)) return false;
  return v.every((row: unknown) => {
    if (row == null || typeof row !== "object") return false;
    if (!("id" in row && "title" in row && "date" in row && "source" in row)) return false;
    const id: unknown = row.id;
    const title: unknown = row.title;
    const date: unknown = row.date;
    const source: unknown = row.source;
    return (
      typeof id === "string" &&
      typeof title === "string" &&
      typeof date === "string" &&
      typeof source === "string"
    );
  });
}

/** 按年懒加载内置日历源；命中 Redis / 内存旁路，miss 则展开并回填 */
export async function getBuiltinCalendarYear(
  source: BuiltinCalendarSourceId,
  year: number,
): Promise<BuiltinCalendarItem[]> {
  const key = builtinCalendarYearCacheKey(source, year);
  const hit = await cacheGetJson<BuiltinCalendarItem[]>(key);
  if (isBuiltinItemArray(hit)) return hit;

  const items = expandBuiltinSourceYear(source, year);
  await cacheSetJson(key, items, TTL_SECONDS);
  return items;
}

/** 当前年 ±1 预热（不阻塞调用方时可 fire-and-forget） */
export function prewarmBuiltinCalendarYears(
  sources: readonly BuiltinCalendarSourceId[] = BUILTIN_CALENDAR_SOURCE_IDS,
  centerYear = new Date().getFullYear(),
): void {
  const years = [centerYear - 1, centerYear, centerYear + 1];
  void Promise.all(
    sources.flatMap((source) => years.map((year) => getBuiltinCalendarYear(source, year))),
  ).catch(() => {
    /* 预热失败可忽略 */
  });
}
