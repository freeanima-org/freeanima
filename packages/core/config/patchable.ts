import type { Config } from "./config-store.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";

/**
 * 支持 patch / replace / reload 的 runtime config（由 server 的
 * `RuntimeConfigStore` 实现；判定本身是纯结构的，放 core 供各层复用）。
 */
export type PatchableRuntimeConfig = Config & {
  patchSection(section: string, patch: Record<string, unknown>): Promise<RuntimeConfig>;
  replaceSection(section: string, value: Record<string, unknown>): Promise<RuntimeConfig>;
  reload(): Promise<RuntimeConfig>;
};

export function isPatchableRuntimeConfig(config: Config): config is PatchableRuntimeConfig {
  return (
    "patchSection" in config &&
    typeof config.patchSection === "function" &&
    "replaceSection" in config &&
    typeof config.replaceSection === "function" &&
    "reload" in config &&
    typeof config.reload === "function"
  );
}
