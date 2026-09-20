import type { RuntimeConfig } from "@freeanima/core/config";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/core/provider";

export type LlmStackConfigurator = (
  cfg: RuntimeConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
) => void;

let configurator: LlmStackConfigurator | null = null;

/** 组合根在 boot 时注入（替代 ctx.llmStack 服务）。 */
export function setLlmStackConfigurator(fn: LlmStackConfigurator): void {
  configurator = fn;
}

export function resetLlmStackConfiguratorForTest(): void {
  configurator = null;
}

/** 用已注入的 configurator 填充 backends/providers；未注入即失败。 */
export function applyLlmStackConfigurator(
  cfg: RuntimeConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
): void {
  if (!configurator) {
    throw new Error("LlmStack configurator not set: call setLlmStackConfigurator first");
  }
  configurator(cfg, backends, providers);
}
