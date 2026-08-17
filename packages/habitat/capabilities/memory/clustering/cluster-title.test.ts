import { describe, expect, it } from "bun:test";

import { sanitizeSemanticClusterTitle, semanticClusterTitleCacheKey } from "./cluster-title.ts";
import { REDIS_CACHE_KEY_PREFIX } from "@freeanima/habitat/core/redis/cache.ts";

describe("sanitizeSemanticClusterTitle", () => {
  it("strips quotes, takes first chunk, truncates to 8", () => {
    expect(sanitizeSemanticClusterTitle('"旅行计划"')).toBe("旅行计划");
    expect(sanitizeSemanticClusterTitle("自我重构与工具集全功能测试").length).toBeLessThanOrEqual(
      8,
    );
    expect(sanitizeSemanticClusterTitle("开发、测试、上线")).toBe("开发");
  });
});

describe("semanticClusterTitleCacheKey", () => {
  it("sorts ids and is stable", () => {
    const a = semanticClusterTitleCacheKey([3, 1, 2]);
    const b = semanticClusterTitleCacheKey([1, 2, 3]);
    expect(a).toBe(b);
    expect(a).toBe(`${REDIS_CACHE_KEY_PREFIX}semantic-cluster-title:v2:1-2-3`);
  });
});
