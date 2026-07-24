import { describe, expect, it } from "bun:test";

import { resetCacheMemoryForTests } from "@freeanima/platform/connectors/redis";

import {
  TAG_SUGGEST_STATS_CACHE_TTL_SECONDS,
  loadTagSuggestStatsCache,
  saveTagSuggestStatsCache,
  tagSuggestStatsCacheKey,
} from "./tag-suggest-cache.ts";

describe("tag-suggest-cache", () => {
  it("key / TTL 约定", () => {
    expect(tagSuggestStatsCacheKey(1, "diary_entry", 10)).toBe(
      "anima:cache:tag-suggest:diary_entry:world:1:top:10",
    );
    expect(TAG_SUGGEST_STATS_CACHE_TTL_SECONDS).toBe(86400);
  });

  it("进程内存旁路可读写", async () => {
    resetCacheMemoryForTests();
    const items = [{ id: 9, title: "日常", count: 3 }];
    await saveTagSuggestStatsCache(7, "task_item", 10, items);
    await expect(loadTagSuggestStatsCache(7, "task_item", 10)).resolves.toEqual(items);
    await expect(loadTagSuggestStatsCache(7, "task_item", 5)).resolves.toBeNull();
    await expect(loadTagSuggestStatsCache(7, "diary_entry", 10)).resolves.toBeNull();
  });
});
