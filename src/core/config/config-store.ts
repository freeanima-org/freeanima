import type { AnimaConfig } from "./schemas/config.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";

let activeRuntimeConfig: Config | null = null;

/** In-memory config container (no file I/O) */
export class Config {
  constructor(protected snapshot: AnimaConfig | RuntimeConfig) {}

  /** Current config snapshot; runtime fields exposed as AnimaConfig for call-site compat */
  get data(): AnimaConfig {
    return this.snapshot as AnimaConfig;
  }

  /** Replace in-memory snapshot (reload / test inject / patch) */
  update(snapshot: AnimaConfig | RuntimeConfig): void {
    this.snapshot = snapshot;
  }

  /** Unit / integration tests without disk */
  static fromSnapshot(snapshot: AnimaConfig | RuntimeConfig): Config {
    return new Config(snapshot);
  }
}

/** Composition root: bind runtime config before engine mechanisms run */
export function bindActiveRuntimeConfig(config: Config): void {
  activeRuntimeConfig = config;
  bindActiveConfig(config);
}

/** @deprecated 使用 bindActiveRuntimeConfig */
export function bindActiveConfig(config: Config): void {
  activeRuntimeConfig = config;
}

export function getActiveRuntimeConfig(): Config {
  if (!activeRuntimeConfig) {
    throw new Error(
      "Active runtime config not bound; call bindActiveRuntimeConfig() or createEngine() first",
    );
  }
  return activeRuntimeConfig;
}

/** @deprecated 使用 getActiveRuntimeConfig */
export function getActiveConfig(): Config {
  return getActiveRuntimeConfig();
}

/** Unit test isolation */
export function resetActiveConfigForTest(): void {
  activeRuntimeConfig = null;
}

/** @deprecated 使用 resetActiveConfigForTest */
export const resetActiveRuntimeConfigForTest = resetActiveConfigForTest;
