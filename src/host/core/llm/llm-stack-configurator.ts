import type { RuntimeConfig } from "@freeanima/host/core/config";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/host/core/provider";

export type LlmStackConfigurator = (
  cfg: RuntimeConfig,
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
  cfg: RuntimeConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
): void {
  if (!configurator) {
    throw new Error("LlmStackConfigurator not registered: load @freeanima/platform first");
  }
  configurator(cfg, backends, providers);
}
