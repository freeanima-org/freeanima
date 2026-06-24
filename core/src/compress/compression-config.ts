import type { AnimaConfig } from "@freeanima/core/config";
import { getActiveConfig } from "@freeanima/core/config";
import {
  getCompressionConfig as resolveCompressionConfig,
  getContextWindow as resolveContextWindow,
  getEffectiveTokenBudget as resolveEffectiveTokenBudget,
  getModelsConfig as resolveModelsConfig,
  usesTokenCompression as resolveUsesTokenCompression,
  type ContextWindowResolveOpts,
  type ModelConfig,
  type ResolvedCompressionConfig,
} from "@freeanima/core/config";

export type { ModelConfig, ResolvedCompressionConfig };

function activeData(): AnimaConfig {
  return getActiveConfig().data;
}

export function getCompressionConfig(cfg: AnimaConfig = activeData()): ResolvedCompressionConfig {
  return resolveCompressionConfig(cfg);
}

export function getModelsConfig(cfg: AnimaConfig = activeData()): Record<string, ModelConfig> {
  return resolveModelsConfig(cfg);
}

export function getContextWindow(
  model: string,
  cfg: AnimaConfig = activeData(),
  opts?: ContextWindowResolveOpts,
): number | null {
  return resolveContextWindow(cfg, model, opts);
}

export function getEffectiveTokenBudget(
  model: string,
  cfg: AnimaConfig = activeData(),
  opts?: ContextWindowResolveOpts,
): number | null {
  return resolveEffectiveTokenBudget(cfg, model, opts);
}

export function usesTokenCompression(
  model: string,
  cfg: AnimaConfig = activeData(),
  opts?: ContextWindowResolveOpts,
): boolean {
  return resolveUsesTokenCompression(cfg, model, opts);
}
