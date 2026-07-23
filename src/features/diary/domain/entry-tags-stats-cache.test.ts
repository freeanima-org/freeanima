import { describe, expect, it } from "bun:test";

import { resetCacheMemoryForTests } from "@freeanima/platform/connectors/redis";

import {
  DIARY_ENTRY_TAGS_STATS_CACHE_TTL_SECONDS,
  diaryEntryTagsStatsCacheKey,
  loadDiaryEntryTagsStatsCache,
  saveDiaryEntryTagsStatsCache,
} from "./entry-tags-stats-cache.ts";

describe("entry-tags-stats-cache", () => {
  it("key / TTL 约定", () => {
    expect(diaryEntryTagsStatsCacheKey(1, 10)).toBe("anima:cache:diary-entry-tags:world:1:top:10");
    expect(DIARY_ENTRY_TAGS_STATS_CACHE_TTL_SECONDS).toBe(86400);
  });

  it("进程内存旁路可读写", async () => {
    resetCacheMemoryForTests();
    const items = [{ tag: "日常", count: 3 }];
    await saveDiaryEntryTagsStatsCache(7, 10, items);
    await expect(loadDiaryEntryTagsStatsCache(7, 10)).resolves.toEqual(items);
    await expect(loadDiaryEntryTagsStatsCache(7, 5)).resolves.toBeNull();
  });
});
