import { afterEach, describe, expect, it, mock } from "bun:test";
import { resetCacheMemoryForTests } from "@freeanima/platform/connectors/redis";
import type { ModelInfo } from "@freeanima/core/provider";

import { saveModelCatalogCache } from "./catalog-cache.ts";

const fetchModelCatalogMock = mock(async (): Promise<ModelInfo[]> => {
  throw new Error("500 status code (no body)");
});

mock.module("./catalog.ts", () => ({
  defaultModelInfo: (model: string): ModelInfo => ({
    model,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportedParams: ["temperature", "maxOutputTokens", "tools", "streaming"],
  }),
  fetchModelCatalog: fetchModelCatalogMock,
  findModelInCatalog: (catalog: ModelInfo[], model: string) =>
    catalog.find((entry) => entry.model === model) ?? null,
}));

const { OpenAiCompatibleBackend } = await import("./backend.ts");

const ctx = {
  baseUrl: "https://example.test/v1",
  apiKey: "sk-test-fallback",
};

describe("OpenAiCompatibleBackend getModel catalog fallback", () => {
  afterEach(() => {
    resetCacheMemoryForTests();
    fetchModelCatalogMock.mockClear();
    fetchModelCatalogMock.mockImplementation(async () => {
      throw new Error("500 status code (no body)");
    });
  });

  it("falls back to default ModelInfo when /models fails and cache empty", async () => {
    const backend = new OpenAiCompatibleBackend("openai_compatible");
    backend.clearCatalogCache();
    const info = await backend.getModel("my-model", ctx);
    expect(info?.model).toBe("my-model");
    expect(info?.contextWindow).toBe(128_000);
    expect(fetchModelCatalogMock).toHaveBeenCalled();
  });

  it("prefers shared cache over failed /models", async () => {
    await saveModelCatalogCache(ctx, [
      {
        model: "cached-model",
        contextWindow: 32_000,
        maxOutputTokens: 2048,
        supportedParams: ["temperature"],
        label: "cached-model",
      },
    ]);
    const backend = new OpenAiCompatibleBackend("openai_compatible");
    backend.clearCatalogCache();
    const info = await backend.getModel("cached-model", ctx);
    expect(info?.model).toBe("cached-model");
    expect(info?.contextWindow).toBe(32_000);
    expect(fetchModelCatalogMock).not.toHaveBeenCalled();
  });
});
