import type { RuntimeConfig } from "./schemas/runtime-config.ts";

let activeRuntimeConfig: Config | null = null;

/** In-memory runtime config container (no file I/O); bootstrap 不进入此对象 */
export class Config {
  constructor(protected snapshot: RuntimeConfig) {}

  /** Current runtime config snapshot */
  get data(): RuntimeConfig {
    return this.snapshot;
  }

  /** Replace in-memory snapshot (reload / test inject / patch) */
  update(snapshot: RuntimeConfig): void {
    this.snapshot = snapshot;
  }

  /** Unit / integration tests without disk */
  static fromSnapshot(snapshot: RuntimeConfig): Config {
    return new Config(snapshot);
  }
}

/** Composition root: bind runtime config before engine mechanisms run */
export function bindActiveRuntimeConfig(config: Config): void {
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

/** Unit test isolation */
export function resetActiveConfigForTest(): void {
  activeRuntimeConfig = null;
}
