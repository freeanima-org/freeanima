import { afterEach, describe, expect, it } from "bun:test";
import { resetCacheMemoryForTests } from "@freeanima/habitat/core/redis";

import {
  LLM_MODEL_CATALOG_CACHE_TTL_SECONDS,
  llmModelCatalogRedisKey,
  loadModelCatalogCache,
  saveModelCatalogCache,
} from "./catalog-cache.ts";
import type { OpenAiCompatibleContext } from "./context.ts";
import type { ModelInfo } from "@freeanima/habitat/core/provider";

const ctx: OpenAiCompatibleContext = {
  baseUrl: "https://example.test/v1",
  apiKey: "sk-test",
};

const sampleCatalog: ModelInfo[] = [
  {
    model: "demo-model",
    contextWindow: 64_000,
    maxOutputTokens: 4096,
    supportedParams: ["temperature", "maxOutputTokens", "tools", "streaming"],
    label: "demo-model",
  },
];

describe("llm model catalog redis cache", () => {
  afterEach(() => {
    resetCacheMemoryForTests();
  });

  it("hashes api key into redis key (no plaintext secret in key)", () => {
    const key = llmModelCatalogRedisKey(ctx);
    expect(key.startsWith("anima:cache:llm-model-catalog:")).toBe(true);
    expect(key).not.toContain("sk-test");
    expect(key).not.toContain("example.test");
  });

  it("round-trips catalog via cache layer", async () => {
    expect(await loadModelCatalogCache(ctx)).toBeNull();
    await saveModelCatalogCache(ctx, sampleCatalog, LLM_MODEL_CATALOG_CACHE_TTL_SECONDS);
    expect(await loadModelCatalogCache(ctx)).toEqual(sampleCatalog);
  });
});
