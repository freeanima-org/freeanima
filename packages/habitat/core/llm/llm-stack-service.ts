import { Service, type Context } from "cordis";
import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/habitat/core/provider";

import { createLlmRuntime, type LlmRuntime } from "./llm-stack.ts";

export type LlmStackConfigurator = (
  cfg: RuntimeConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
) => void;

declare module "cordis" {
  interface Context {
    llmStack: LlmStackService;
  }
}

export type LlmStackServiceConfig = {
  configurator: LlmStackConfigurator;
};

/**
 * Cordis service owning the LLM stack (`ctx.llmStack`): the provider/backend
 * configurator plus the runtime built from the active config. Replaces the
 * former module-level runtime singleton.
 */
export class LlmStackService extends Service {
  private readonly configurator: LlmStackConfigurator;
  private runtime: LlmRuntime | null = null;
  private config: RuntimeConfig | null = null;

  constructor(ctx: Context, config: LlmStackServiceConfig) {
    super(ctx, "llmStack");
    this.configurator = config.configurator;
  }

  configure(cfg: RuntimeConfig, backends: BackendRegistry, providers: ProviderRegistry): void {
    this.configurator(cfg, backends, providers);
  }

  /** (Re)build the runtime from config; called on boot and runtime config apply. */
  initRuntime(cfg: RuntimeConfig): LlmRuntime {
    this.config = cfg;
    this.runtime = createLlmRuntime(cfg);
    return this.runtime;
  }

  getRuntime(): LlmRuntime {
    if (!this.runtime) {
      throw new Error("LLM runtime not initialized: call initLlmRuntime() first");
    }
    return this.runtime;
  }

  getConfig(): RuntimeConfig | null {
    return this.config;
  }

  reset(): void {
    this.runtime = null;
    this.config = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountLlmStackService(
  ctx: Context,
  configurator: LlmStackConfigurator,
): LlmStackService {
  const existing = ctx.llmStack as LlmStackService | undefined;
  if (existing) return existing;
  return new LlmStackService(ctx, { configurator });
}
