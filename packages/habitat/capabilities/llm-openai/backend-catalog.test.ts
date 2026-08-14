import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import { resetCacheMemoryForTests } from "@freeanima/habitat/core/redis";
import type { ModelInfo } from "@freeanima/habitat/core/provider";

import { saveModelCatalogCache } from "./catalog-cache.ts";

const fetchModelCatalogMock = mock(async (): Promise<ModelInfo[]> => {
  throw new Error("500 status code (no body)");
});

const defaultModelInfoImpl = (model: string): ModelInfo => ({
  model,
  contextWindow: 128_000,
  maxOutputTokens: 8192,
  supportedParams: ["temperature", "maxOutputTokens", "tools", "streaming"],
});

const catalogOriginal = await import("./catalog.ts");
const enrichOriginal = await import("./models-dev/enrich.ts");

mock.module("./catalog.ts", () => ({
  ...catalogOriginal,
  defaultModelInfo: defaultModelInfoImpl,
  defaultModelInfoEnriched: async (model: string): Promise<ModelInfo> =>
    defaultModelInfoImpl(model),
  fetchModelCatalog: fetchModelCatalogMock,
  findModelInCatalog: (catalog: ModelInfo[], model: string) =>
    catalog.find((entry) => entry.model === model) ?? null,
}));

mock.module("./models-dev/enrich.ts", () => ({
  ...enrichOriginal,
  enrichCatalogFromModelsDev: async (catalog: ModelInfo[]) => catalog,
  enrichModelInfoFromModelsDev: async (info: ModelInfo) => info,
}));

afterAll(() => {
  mock.module("./catalog.ts", () => catalogOriginal);
  mock.module("./models-dev/enrich.ts", () => enrichOriginal);
});

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
