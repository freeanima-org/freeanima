import { afterAll, describe, expect, it, mock } from "bun:test";
import { resetCacheMemoryForTests } from "@freeanima/core/redis";
import type { ModelInfo } from "@freeanima/core/provider";

import { fetchModelCatalog } from "./catalog.ts";
import { loadModelCatalogCache } from "./catalog-cache.ts";

/**
 * 目录查询失败冷却期回归护栏。
 *
 * 背景：`/models` 只是可选增强。网关不可达（离线 / 自签证书 / 域名写错）时，每次
 * `getModel` 都要吃满一次连接超时。`OpenAiCompatibleBackend` 的目录缓存只记成功结果，
 * 而 `initLlmRuntime` 每次都会新建 backend，导致同一不可达网关被反复重试 ——
 * 集成测试里表现为 `computeStats` / `/stats` 每个用例多花数秒。
 *
 * 这里锁住两条不变式：
 * 1. 失败后的冷却期内不再发起网络请求（只付一次超时代价）；
 * 2. 成功结果不受影响，且成功会清掉冷却状态。
 *
 * 注：本文件用 `mock.module` 替换 `fetchModelCatalog` 只统计调用次数，不模拟时序 ——
 * 冷却确实生效时调用次数必须为 1。
 */

let fetchCalls = 0;
/** 由各用例决定目录查询成功还是失败 */
let fetchImpl: () => Promise<ModelInfo[]> = async () => {
  throw new Error("ECONNREFUSED");
};

const catalogOriginal = await import("./catalog.ts");
const enrichOriginal = await import("./models-dev/enrich.ts");

mock.module("./catalog.ts", () => ({
  ...catalogOriginal,
  fetchModelCatalog: async (): Promise<ModelInfo[]> => {
    fetchCalls += 1;
    return fetchImpl();
  },
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

const ctx = { baseUrl: "https://unreachable.test/v1", apiKey: "sk-test" };

const CATALOG: ModelInfo[] = [
  {
    model: "real-model",
    contextWindow: 64_000,
    maxOutputTokens: 4096,
    supportedParams: ["temperature"],
    label: "real-model",
  },
];

function resetState(): void {
  resetCacheMemoryForTests();
  fetchCalls = 0;
  fetchImpl = async () => {
    throw new Error("ECONNREFUSED");
  };
}

// Bun 的 mock.module 无法在 afterEach 里安全恢复，这里每个用例自建 backend 并显式重置
describe("catalog failure cooldown", () => {
  it("only pays the connect timeout once across repeated getModel calls", async () => {
    resetState();
    const backend = new OpenAiCompatibleBackend("openai_compatible");

    // 第一次失败：发起网络请求并记录冷却
    await backend.getModel("m", ctx);
    expect(fetchCalls).toBe(1);

    // 后续调用命中冷却：不再发请求，但仍返回可用的回退值
    const second = await backend.getModel("m", ctx);
    const third = await backend.getModel("m", ctx);
    expect(fetchCalls).toBe(1);
    expect(second?.model).toBe("m");
    expect(third?.model).toBe("m");
  });

  it("still resolves a real catalog normally and clears the cooldown on success", async () => {
    resetState();
    const backend = new OpenAiCompatibleBackend("openai_compatible");

    // 先失败一次进入冷却
    await backend.getModel("real-model", ctx);
    expect(fetchCalls).toBe(1);

    // 网关恢复：清缓存（含冷却）后应重新探测并拿到真实目录
    backend.clearCatalogCache();
    fetchImpl = async () => CATALOG;
    const info = await backend.getModel("real-model", ctx);
    expect(fetchCalls).toBe(2);
    expect(info?.contextWindow).toBe(64_000);

    // 成功结果进入正常缓存，后续调用不再打网络
    await backend.getModel("real-model", ctx);
    expect(fetchCalls).toBe(2);
  });

  it("keeps listModels able to report failure instead of silently degrading", async () => {
    resetState();
    const backend = new OpenAiCompatibleBackend("openai_compatible");

    await expect(backend.listModels(ctx)).rejects.toThrow();
    expect(fetchCalls).toBe(1);

    // 冷却期内 listModels 明确失败，而不是假装成功
    await expect(backend.listModels(ctx)).rejects.toThrow();
    expect(fetchCalls).toBe(1);
  });

  it("does not cache failures in the shared Redis catalog cache", async () => {
    resetState();
    const backend = new OpenAiCompatibleBackend("openai_compatible");
    await backend.getModel("m", ctx);
    // 失败不得写入共享缓存，否则其他 backend 实例会拿到空的「成功」结果
    expect(await loadModelCatalogCache(ctx)).toBeNull();
  });
});

// 保持 fetchModelCatalog 的真实实现被引用，避免 lint 误判未使用导入
void fetchModelCatalog;
