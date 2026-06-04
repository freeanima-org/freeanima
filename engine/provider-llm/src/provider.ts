import type { BackendContext, BackendRegistry, LlmBackend } from "./backend.js";
import { clampCallParams, mergeCallParams, type LlmCallParams, type ModelInfo } from "./model.js";
import { isProviderError, type ProviderError } from "./errors.js";

export type ProviderSpec = {
  id: string;
  backendId: string;
  context: BackendContext;
};

export type ProviderHealth = {
  healthy: boolean;
  lastError?: ProviderError;
  updatedAt: number;
};

/**
 * Provider：连接实例 = Backend + context。
 * 维护健康状态；params 在 invoke 前经 prepareParams 合并与 clamp。
 */
export class LlmProvider {
  private health: ProviderHealth = { healthy: true, updatedAt: Date.now() };

  constructor(
    readonly id: string,
    readonly backendId: string,
    readonly context: BackendContext,
    readonly backend: LlmBackend,
  ) {}

  static fromSpec(spec: ProviderSpec, backends: BackendRegistry): LlmProvider {
    return new LlmProvider(spec.id, spec.backendId, spec.context, backends.get(spec.backendId));
  }

  getHealth(): Readonly<ProviderHealth> {
    return this.health;
  }

  /** 记录失败并标记不健康；返回映射后的 ProviderError */
  reportFailure(err: unknown): ProviderError {
    const mapped = isProviderError(err) ? err : this.mapError(err);
    this.health = { healthy: false, lastError: mapped, updatedAt: Date.now() };
    return mapped;
  }

  markHealthy(): void {
    this.health = { healthy: true, updatedAt: Date.now() };
  }

  getModel(model: string): Promise<ModelInfo | null> {
    return this.backend.getModel(model, this.context);
  }

  mapError(err: unknown): ProviderError {
    return this.backend.mapError(err, this.context, { providerId: this.id });
  }

  /** Engine invoke 前：合并多层 params 并按 catalog clamp */
  async prepareParams(model: string, ...layers: Partial<LlmCallParams>[]): Promise<LlmCallParams> {
    const merged = mergeCallParams(...layers);
    const modelInfo = await this.getModel(model);
    if (!modelInfo) {
      throw new Error(`provider "${this.id}" 无法解析 model "${model}"`);
    }
    return clampCallParams(merged, modelInfo);
  }
}

export class ProviderRegistry {
  private readonly specs = new Map<string, ProviderSpec>();
  private readonly materialized = new Map<string, LlmProvider>();

  constructor(private readonly backends: BackendRegistry) {}

  register(provider: LlmProvider): void {
    if (this.specs.has(provider.id)) {
      throw new Error(`provider "${provider.id}" 已有待实例化 spec，不能重复 register`);
    }
    this.materialized.set(provider.id, provider);
  }

  registerSpec(spec: ProviderSpec): void {
    if (this.materialized.has(spec.id)) {
      throw new Error(`provider "${spec.id}" 已实例化，不能重复 registerSpec`);
    }
    this.specs.set(spec.id, spec);
  }

  has(id: string): boolean {
    return this.materialized.has(id) || this.specs.has(id);
  }

  get(id: string): LlmProvider {
    const existing = this.materialized.get(id);
    if (existing) return existing;

    const spec = this.specs.get(id);
    if (!spec) {
      throw new Error(`未找到 provider: ${id}`);
    }

    const provider = LlmProvider.fromSpec(spec, this.backends);
    this.materialized.set(id, provider);
    return provider;
  }

}
