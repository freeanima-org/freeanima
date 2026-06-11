import type { AnimaConfig } from "@freeanima/engine-config";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/engine-provider-llm";

export type LlmStackConfigurator = (
  cfg: AnimaConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
) => void;

let configurator: LlmStackConfigurator | null = null;

export function registerLlmStackConfigurator(fn: LlmStackConfigurator): void {
  configurator = fn;
}

export function unregisterLlmStackConfigurator(): void {
  configurator = null;
}

export function applyLlmStackConfigurator(
  cfg: AnimaConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
): void {
  if (!configurator) {
    throw new Error("LlmStackConfigurator not registered: load @freeanima/service first");
  }
  configurator(cfg, backends, providers);
}
