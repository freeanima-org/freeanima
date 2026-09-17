import type { RuntimeConfig } from "@freeanima/core/config";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/core/provider";
import { getRootContextOrNull } from "@freeanima/kernel";

export type { LlmStackConfigurator } from "./llm-stack-service.ts";

/** Resolve the configurator from `ctx.llmStack`; throws when never mounted. */
export function applyLlmStackConfigurator(
  cfg: RuntimeConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
): void {
  const service = getRootContextOrNull()?.llmStack;
  if (!service) {
    throw new Error("LlmStackService not mounted: load @freeanima/platform first");
  }
  service.configure(cfg, backends, providers);
}
