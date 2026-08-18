import type { ChatCompletion, ChatRequest, ChatStreamEvent } from "./invoke.ts";
import type { ModelInfo } from "./model.ts";
import { ProviderError } from "./errors.ts";

/** Connection context held by Format adapter; capabilities fill from parsed config */
export type BackendContext = Record<string, unknown>;

/**
 * Format adapter (historically `LlmBackend`): one LLM wire protocol.
 * Multiple Connections (LlmProvider) may share one Format; gateway presets may
 * pick Format per model via `ProviderSpec.resolveFormat`.
 */
export abstract class LlmBackend {
  constructor(readonly id: string) {}

  abstract listModels(context: BackendContext): Promise<ModelInfo[]>;

  abstract getModel(model: string, context: BackendContext): Promise<ModelInfo | null>;

  abstract mapError(
    err: unknown,
    context: BackendContext,
    meta?: { providerId?: string },
  ): ProviderError;

  abstract chat(
    model: string,
    request: ChatRequest,
    context: BackendContext,
  ): Promise<ChatCompletion>;

  abstract chatStream(
    model: string,
    request: ChatRequest,
    context: BackendContext,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent>;
}

export class BackendRegistry {
  /** Explicit constructor: avoid Bun coverage counting implicit ctor as uncovered (oven-sh/bun#7025) */
  // oxlint-disable-next-line eslint/no-useless-constructor -- Bun coverage (oven-sh/bun#7025)
  constructor() {}

  private readonly backends = new Map<string, LlmBackend>();

  register(backend: LlmBackend): void {
    if (this.backends.has(backend.id)) {
      throw new Error(`backend adapter "${backend.id}" already registered`);
    }
    this.backends.set(backend.id, backend);
  }

  get(id: string): LlmBackend {
    const backend = this.backends.get(id);
    if (!backend) {
      throw new Error(`Backend adapter not found: ${id}`);
    }
    return backend;
  }

  has(id: string): boolean {
    return this.backends.has(id);
  }

  list(): LlmBackend[] {
    return [...this.backends.values()];
  }
}
