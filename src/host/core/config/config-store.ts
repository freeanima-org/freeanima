/**
 * Config 容器 — 机制在 kernel；本模块固定产品 RuntimeConfig 类型。
 * @see @freeanima/host/kernel/config-mechanism
 */
import {
  Config as KernelConfig,
  bindActiveRuntimeConfig as bindActiveRuntimeConfigKernel,
  getActiveRuntimeConfig as getActiveRuntimeConfigKernel,
  peekActiveRuntimeConfig as peekActiveRuntimeConfigKernel,
  resetActiveConfigForTest,
} from "@freeanima/host/kernel/config-mechanism";

import type { RuntimeConfig } from "./schemas/runtime-config.ts";

export class Config extends KernelConfig<RuntimeConfig> {
  /** 单测 / 集成测：无磁盘 */
  static fromSnapshot(snapshot: RuntimeConfig): Config {
    return new Config(snapshot);
  }
}

export function bindActiveRuntimeConfig(config: Config): void {
  bindActiveRuntimeConfigKernel(config);
}

export function getActiveRuntimeConfig(): Config {
  return getActiveRuntimeConfigKernel();
}

export function peekActiveRuntimeConfig(): Config | null {
  return peekActiveRuntimeConfigKernel();
}

export { resetActiveConfigForTest };
