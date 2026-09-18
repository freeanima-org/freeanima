import {
  LlmBackend,
  collectChatCompletion,
  type BackendContext,
  type ChatCompletion,
  type ChatRequest,
  type ChatStreamEvent,
  type ModelInfo,
  type ProviderError,
} from "@freeanima/core/provider";
import type OpenAI from "openai";
import { contextCacheKey, parseOpenAiCompatibleContext } from "./context.ts";
import type { OpenAiCompatibleContext } from "./context.ts";
import { createOpenAiClientFromParsed } from "./client.ts";
import {
  defaultModelInfo,
  defaultModelInfoEnriched,
  fetchModelCatalog,
  findModelInCatalog,
} from "./catalog.ts";
import { loadModelCatalogCache, saveModelCatalogCache } from "./catalog-cache.ts";
import { enrichCatalogFromModelsDev, enrichModelInfoFromModelsDev } from "./models-dev/enrich.ts";
import { mapOpenAiCompatibleError } from "./map-error.ts";
import { runOpenAiChatStream } from "./openai-chat.ts";

/**
 * `/models` 目录查询是可选增强（拿不到就回退 models.dev / 默认值）。
 * 不可达或证书错误的网关会让连接尝试吃满 connectMs，所以目录专用客户端关掉 SDK
 * 重试（`retries: 0`）并再划一个总预算；推理路径的客户端不受影响，仍保留 SDK 重试。
 *
 * 预算保持在秒级即可：目录拿不到会立刻回退 models.dev / 默认值，调用方（compression
 * context_window、stats）并不需要等待更久。失败还会被 {@link CATALOG_FAILURE_TTL_MS}
 * 记住，避免同一网关被反复重试。
 */
const CATALOG_FETCH_BUDGET_MS = 1_000;

/**
 * 目录查询失败后的冷却期。不可达网关（离线 / 自签证书 / 域名打错）失败的代价是
 * `CATALOG_FETCH_BUDGET_MS` 量级的连接超时；没有冷却的话每个调用方都会重付一次。
 * 冷却期内直接走回退值，避免「每个测试/每次 stats 都等一次连接超时」。
 * TTL 取短值，网络恢复后无需重启进程即可自动回到正常探测。
 */
const CATALOG_FAILURE_TTL_MS = 60_000;

/** 目录查询专用客户端：显式关掉 SDK 重试，重试预算由 CATALOG_FETCH_BUDGET_MS 表达 */
function createCatalogClient(parsed: OpenAiCompatibleContext): OpenAI {
  return createOpenAiClientFromParsed(parsed, { retries: 0 });
}

/** 目录查询统一入口：预算内取不到即抛，调用方各自决定回退策略 */
function fetchCatalogWithinBudget(client: OpenAI): Promise<ModelInfo[]> {
  return fetchModelCatalog(client, AbortSignal.timeout(CATALOG_FETCH_BUDGET_MS));
}

/** OpenAI Chat Completions compatible backend (DeepSeek, OpenRouter compatible mode, etc.). */
export class OpenAiCompatibleBackend extends LlmBackend {
  private readonly catalogCache = new Map<string, ModelInfo[]>();
  /** cacheKey → 上次目录查询失败的时间戳；冷却期内不再重试 */
  private readonly catalogFailureAt = new Map<string, number>();

  /** 目录查询是否处于失败冷却期（命中即跳过网络，直接用回退值） */
  private isCatalogCoolingDown(cacheKey: string, now: number): boolean {
    const failedAt = this.catalogFailureAt.get(cacheKey);
    if (failedAt === undefined) return false;
    if (now - failedAt >= CATALOG_FAILURE_TTL_MS) {
      this.catalogFailureAt.delete(cacheKey);
      return false;
    }
    return true;
  }

  /** 在预算内拉取目录并写入缓存；失败记录冷却时间后继续抛出 */
  private async loadCatalogWithinBudget(
    parsed: OpenAiCompatibleContext,
    cacheKey: string,
  ): Promise<ModelInfo[]> {
    try {
      const client = createCatalogClient(parsed);
      const raw = await fetchCatalogWithinBudget(client);
      const catalog = await enrichCatalogFromModelsDev(raw);
      this.catalogCache.set(cacheKey, catalog);
      this.catalogFailureAt.delete(cacheKey);
      await saveModelCatalogCache(parsed, catalog);
      return catalog;
    } catch (err) {
      this.catalogFailureAt.set(cacheKey, Date.now());
      throw err;
    }
  }

  async listModels(context: BackendContext): Promise<ModelInfo[]> {
    const parsed = parseOpenAiCompatibleContext(context);
    const cacheKey = contextCacheKey(parsed);
    const cached = this.catalogCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const fromShared = await loadModelCatalogCache(parsed);
    if (fromShared) {
      const enriched = await enrichCatalogFromModelsDev(fromShared);
      this.catalogCache.set(cacheKey, enriched);
      return enriched;
    }

    // listModels 明确要求目录：冷却期内不重试网络，直接抛出，由调用方决定如何降级
    if (this.isCatalogCoolingDown(cacheKey, Date.now())) {
      throw new Error("model catalog unavailable (recent failure, cooling down)");
    }

    try {
      return await this.loadCatalogWithinBudget(parsed, cacheKey);
    } catch (err) {
      throw this.mapError(err, context);
    }
  }

  async getModel(model: string, context: BackendContext): Promise<ModelInfo | null> {
    const parsed = parseOpenAiCompatibleContext(context);
    const cacheKey = contextCacheKey(parsed);
    let catalog = this.catalogCache.get(cacheKey);
    if (!catalog) {
      const fromShared = await loadModelCatalogCache(parsed);
      if (fromShared) {
        catalog = await enrichCatalogFromModelsDev(fromShared);
        this.catalogCache.set(cacheKey, catalog);
      }
    }
    if (!catalog) {
      // 上次失败仍在冷却期：跳过网络，直接用回退值，避免每个调用方重付一次连接超时
      if (this.isCatalogCoolingDown(cacheKey, Date.now())) {
        return defaultModelInfoEnriched(model);
      }
      try {
        catalog = await this.loadCatalogWithinBudget(parsed, cacheKey);
      } catch {
        // /models flaky on many compatible gateways — keep chat usable
        return defaultModelInfoEnriched(model);
      }
    }
    const found = findModelInCatalog(catalog, model);
    if (found) {
      return enrichModelInfoFromModelsDev(found);
    }
    return enrichModelInfoFromModelsDev(defaultModelInfo(model), { preferModelsDevLimits: true });
  }

  mapError(err: unknown, _context: BackendContext, meta?: { providerId?: string }): ProviderError {
    return mapOpenAiCompatibleError(err, meta);
  }

  async chat(
    model: string,
    request: ChatRequest,
    context: BackendContext,
  ): Promise<ChatCompletion> {
    try {
      return await collectChatCompletion(
        runOpenAiChatStream(model, request, context, request.signal),
      );
    } catch (err) {
      throw this.mapError(err, context);
    }
  }

  async *chatStream(
    model: string,
    request: ChatRequest,
    context: BackendContext,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    try {
      yield* runOpenAiChatStream(model, request, context, signal);
    } catch (err) {
      throw this.mapError(err, context);
    }
  }

  /** 清空目录缓存与失败冷却（显式要求重新探测目录时使用） */
  clearCatalogCache(): void {
    this.catalogCache.clear();
    this.catalogFailureAt.clear();
  }
}
