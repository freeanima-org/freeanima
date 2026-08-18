import {
  LlmBackend,
  collectChatCompletion,
  type BackendContext,
  type ChatCompletion,
  type ChatRequest,
  type ChatStreamEvent,
  type ModelInfo,
  type ProviderError,
} from "@freeanima/habitat/core/provider";
import { contextCacheKey, parseOpenAiCompatibleContext } from "./context.ts";
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

/** OpenAI Chat Completions compatible backend (DeepSeek, OpenRouter compatible mode, etc.). */
export class OpenAiCompatibleBackend extends LlmBackend {
  private readonly catalogCache = new Map<string, ModelInfo[]>();

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

    const client = createOpenAiClientFromParsed(parsed);
    try {
      const raw = await fetchModelCatalog(client);
      const catalog = await enrichCatalogFromModelsDev(raw);
      this.catalogCache.set(cacheKey, catalog);
      await saveModelCatalogCache(parsed, catalog);
      return catalog;
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
      try {
        const client = createOpenAiClientFromParsed(parsed);
        const raw = await fetchModelCatalog(client);
        catalog = await enrichCatalogFromModelsDev(raw);
        this.catalogCache.set(cacheKey, catalog);
        await saveModelCatalogCache(parsed, catalog);
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

  clearCatalogCache(): void {
    this.catalogCache.clear();
  }
}
