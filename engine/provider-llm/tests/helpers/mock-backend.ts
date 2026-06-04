import {
  LlmBackend,
  ProviderError,
  type BackendContext,
  type ChatCompletion,
  type ChatRequest,
  type ChatStreamEvent,
  type ModelInfo,
} from "../../src/index";

export type MockBackendOptions = {
  id?: string;
  modelInfo?: ModelInfo;
  chatResult?: ChatCompletion;
  chatError?: unknown;
  streamEvents?: ChatStreamEvent[];
  streamError?: unknown;
};

export class MockBackend extends LlmBackend {
  readonly chatCalls: Array<{ model: string; request: ChatRequest; context: BackendContext }> = [];
  readonly streamCalls: Array<{ model: string; request: ChatRequest; context: BackendContext }> =
    [];
  private readonly defaultModelInfo: ModelInfo;
  private readonly chatResult: ChatCompletion;
  private readonly chatError?: unknown;
  private readonly streamEvents: ChatStreamEvent[];
  private readonly streamError?: unknown;

  constructor(options: MockBackendOptions = {}) {
    super(options.id ?? "mock");
    this.defaultModelInfo = options.modelInfo ?? {
      model: "test-model",
      contextWindow: 128_000,
      maxOutputTokens: 8192,
      supportedParams: ["temperature", "maxOutputTokens", "topP", "stop", "extra"],
    };
    this.chatResult = options.chatResult ?? { content: "ok", model: "test-model" };
    this.chatError = options.chatError;
    this.streamEvents = options.streamEvents ?? [
      { type: "content", content: "chunk" },
      { type: "done", model: "test-model", finish_reason: "stop" },
    ];
    this.streamError = options.streamError;
  }

  async listModels(_context: BackendContext): Promise<ModelInfo[]> {
    return [this.defaultModelInfo];
  }

  async getModel(model: string, _context: BackendContext): Promise<ModelInfo | null> {
    if (model === "__missing__") return null;
    return { ...this.defaultModelInfo, model };
  }

  mapError(err: unknown, _context: BackendContext, meta?: { providerId?: string }): ProviderError {
    if (err instanceof ProviderError) return err;
    return new ProviderError(String(err), "unknown", false, { providerId: meta?.providerId });
  }

  async chat(
    model: string,
    request: ChatRequest,
    context: BackendContext,
  ): Promise<ChatCompletion> {
    this.chatCalls.push({ model, request, context });
    if (this.chatError) throw this.chatError;
    return { ...this.chatResult, model };
  }

  async *chatStream(
    model: string,
    request: ChatRequest,
    context: BackendContext,
  ): AsyncIterable<ChatStreamEvent> {
    this.streamCalls.push({ model, request, context });
    if (this.streamError) throw this.streamError;
    for (const event of this.streamEvents) {
      yield event;
    }
  }
}
