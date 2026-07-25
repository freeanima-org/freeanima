import type { RuntimeConfig } from "../config/schemas/runtime-config.ts";
import { getActiveRuntimeConfig } from "../config/config-store.ts";
import {
  getCompressionConfig as resolveCompressionConfig,
  getContextWindow as resolveContextWindow,
  getEffectiveTokenBudget as resolveEffectiveTokenBudget,
  getModelsConfig as resolveModelsConfig,
  usesTokenCompression as resolveUsesTokenCompression,
  type ContextWindowResolveOpts,
  type ModelConfig,
  type ResolvedCompressionConfig,
} from "../config/compression-config.ts";

export type { ModelConfig, ResolvedCompressionConfig };

function activeData(): RuntimeConfig {
  return getActiveRuntimeConfig().data;
}

export function getCompressionConfig(cfg: RuntimeConfig = activeData()): ResolvedCompressionConfig {
  return resolveCompressionConfig(cfg);
}

export function getModelsConfig(cfg: RuntimeConfig = activeData()): Record<string, ModelConfig> {
  return resolveModelsConfig(cfg);
}

export function getContextWindow(
  model: string,
  cfg: RuntimeConfig = activeData(),
  opts?: ContextWindowResolveOpts,
): number | null {
  return resolveContextWindow(cfg, model, opts);
}

export function getEffectiveTokenBudget(
  model: string,
  cfg: RuntimeConfig = activeData(),
  opts?: ContextWindowResolveOpts,
): number | null {
  return resolveEffectiveTokenBudget(cfg, model, opts);
}

export function usesTokenCompression(
  model: string,
  cfg: RuntimeConfig = activeData(),
  opts?: ContextWindowResolveOpts,
): boolean {
  return resolveUsesTokenCompression(cfg, model, opts);
}
