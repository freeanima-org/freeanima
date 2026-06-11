import type { AnimaConfig } from "./schemas/config.ts";

let runtimeConfig: AnimaConfig | null = null;

/** Composition root: register loaded config before engine mechanisms run */
export function registerRuntimeConfig(cfg: AnimaConfig): void {
  runtimeConfig = cfg;
}

export function getRuntimeConfig(): AnimaConfig {
  if (!runtimeConfig) {
    throw new Error(
      "Runtime config not registered; composition root must call registerRuntimeConfig()",
    );
  }
  return runtimeConfig;
}

/** Unit test isolation */
export function resetRuntimeConfigForTest(): void {
  runtimeConfig = null;
}
