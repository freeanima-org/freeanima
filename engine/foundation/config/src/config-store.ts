import type { AnimaConfig } from "./schemas/config.ts";

let activeConfig: Config | null = null;

/** In-memory config container (no file I/O) */
export class Config {
  constructor(private snapshot: AnimaConfig) {}

  /** Current config snapshot; pure helpers use config.data */
  get data(): AnimaConfig {
    return this.snapshot;
  }

  /** Replace in-memory snapshot (reload / test inject / patch) */
  update(snapshot: AnimaConfig): void {
    this.snapshot = snapshot;
  }

  /** Unit / integration tests without disk */
  static fromSnapshot(snapshot: AnimaConfig): Config {
    return new Config(snapshot);
  }
}

/** Composition root: bind the active Config before engine mechanisms run */
export function bindActiveConfig(config: Config): void {
  activeConfig = config;
}

export function getActiveConfig(): Config {
  if (!activeConfig) {
    throw new Error("Active Config not bound; call createEngine() or bindActiveConfig() first");
  }
  return activeConfig;
}

/** Unit test isolation */
export function resetActiveConfigForTest(): void {
  activeConfig = null;
}
