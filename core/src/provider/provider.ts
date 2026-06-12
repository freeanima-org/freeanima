import type { BackendContext, BackendRegistry, LlmBackend } from "./backend.ts";
import { clampCallParams, mergeCallParams, type LlmCallParams, type ModelInfo } from "./model.ts";
import { isProviderError, type ProviderError } from "./errors.ts";

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
 * Provider: connection instance = Backend + context.
 * Maintains health; params merged and clamped via prepareParams before invoke.
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

  /** Record failure and mark unhealthy; return mapped ProviderError */
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

  /** Before Engine invoke: merge layered params and clamp per catalog */
  async prepareParams(model: string, ...layers: Partial<LlmCallParams>[]): Promise<LlmCallParams> {
    const merged = mergeCallParams(...layers);
    const modelInfo = await this.getModel(model);
    if (!modelInfo) {
      throw new Error(`provider "${this.id}" cannot resolve model "${model}"`);
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
      throw new Error(
        `provider "${provider.id}" already has a pending spec; cannot register again`,
      );
    }
    this.materialized.set(provider.id, provider);
  }

  registerSpec(spec: ProviderSpec): void {
    if (this.materialized.has(spec.id)) {
      throw new Error(`provider "${spec.id}" already instantiated; cannot registerSpec again`);
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
      throw new Error(`Provider not found: ${id}`);
    }

    const provider = LlmProvider.fromSpec(spec, this.backends);
    this.materialized.set(id, provider);
    return provider;
  }
}
