import type { ChatCompletion, ChatRequest, ChatStreamEvent } from "./invoke";
import type { ModelInfo } from "./model";
import { ProviderError } from "./errors";

/** Backend adapter 持有的连接上下文；capabilities 从 config parse 后填入 */
export type BackendContext = Record<string, unknown>;

/**
 * Backend：协议 adapter 基类（capabilities 继承实现）。
 * 多个 Provider 实例可绑定同一 Backend。
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
  ): AsyncIterable<ChatStreamEvent>;
}

export class BackendRegistry {
  /** 显式构造函数：避免 Bun coverage 将隐式构造计为未覆盖（oven-sh/bun#7025） */
  constructor() {}

  private readonly backends = new Map<string, LlmBackend>();

  register(backend: LlmBackend): void {
    if (this.backends.has(backend.id)) {
      throw new Error(`backend adapter "${backend.id}" 已注册`);
    }
    this.backends.set(backend.id, backend);
  }

  get(id: string): LlmBackend {
    const backend = this.backends.get(id);
    if (!backend) {
      throw new Error(`未找到 backend adapter: ${id}`);
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
