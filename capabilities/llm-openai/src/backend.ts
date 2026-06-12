import {
  LlmBackend,
  type BackendContext,
  type ChatCompletion,
  type ChatRequest,
  type ChatStreamEvent,
  type ModelInfo,
  type ProviderError,
} from "@freeanima/core/provider";
import { contextCacheKey, parseOpenAiCompatibleContext } from "./context.ts";
import { createOpenAiClientFromParsed } from "./client.ts";
import { defaultModelInfo, fetchModelCatalog, findModelInCatalog } from "./catalog.ts";
import { mapOpenAiCompatibleError } from "./map-error.ts";
import { runOpenAiChat, runOpenAiChatStream } from "./openai-chat.ts";

/** OpenAI Chat Completions compatible backend (DeepSeek, OpenRouter compatible mode, etc.). */
export class OpenAiCompatibleBackend extends LlmBackend {
  private readonly catalogCache = new Map<string, ModelInfo[]>();

  constructor(backendId: string) {
    super(backendId);
  }

  async listModels(context: BackendContext): Promise<ModelInfo[]> {
    const parsed = parseOpenAiCompatibleContext(context);
    const cacheKey = contextCacheKey(parsed);
    const cached = this.catalogCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const client = createOpenAiClientFromParsed(parsed);
    try {
      const catalog = await fetchModelCatalog(client);
      this.catalogCache.set(cacheKey, catalog);
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
      catalog = await this.listModels(context);
    }
    return findModelInCatalog(catalog, model) ?? defaultModelInfo(model);
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
      return await runOpenAiChat(model, request, context);
    } catch (err) {
      throw this.mapError(err, context);
    }
  }

  async *chatStream(
    model: string,
    request: ChatRequest,
    context: BackendContext,
  ): AsyncIterable<ChatStreamEvent> {
    try {
      yield* runOpenAiChatStream(model, request, context);
    } catch (err) {
      throw this.mapError(err, context);
    }
  }

  clearCatalogCache(): void {
    this.catalogCache.clear();
  }
}
