import { Service, type Context } from "cordis";
import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/habitat/core/provider";

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

/** Cordis service exposing the LLM backend/provider configurator as `ctx.llmStack`. */
export class LlmStackService extends Service {
  private readonly configurator: LlmStackConfigurator;

  constructor(ctx: Context, config: LlmStackServiceConfig) {
    super(ctx, "llmStack");
    this.configurator = config.configurator;
  }

  configure(cfg: RuntimeConfig, backends: BackendRegistry, providers: ProviderRegistry): void {
    this.configurator(cfg, backends, providers);
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
