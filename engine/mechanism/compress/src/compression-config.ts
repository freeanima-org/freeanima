import type { AnimaConfig } from "@freeanima/engine-config";
import {
  getCompressionConfig as resolveCompressionConfig,
  getContextWindow as resolveContextWindow,
  getEffectiveTokenBudget as resolveEffectiveTokenBudget,
  getModelsConfig as resolveModelsConfig,
  usesTokenCompression as resolveUsesTokenCompression,
  getRuntimeConfig,
  type ModelConfig,
  type ResolvedCompressionConfig,
} from "@freeanima/engine-config";

export type { ModelConfig, ResolvedCompressionConfig };

export function getCompressionConfig(
  cfg: AnimaConfig = getRuntimeConfig(),
): ResolvedCompressionConfig {
  return resolveCompressionConfig(cfg);
}

export function getModelsConfig(
  cfg: AnimaConfig = getRuntimeConfig(),
): Record<string, ModelConfig> {
  return resolveModelsConfig(cfg);
}

export function getContextWindow(
  model: string,
  cfg: AnimaConfig = getRuntimeConfig(),
): number | null {
  return resolveContextWindow(cfg, model);
}

export function getEffectiveTokenBudget(
  model: string,
  cfg: AnimaConfig = getRuntimeConfig(),
): number | null {
  return resolveEffectiveTokenBudget(cfg, model);
}

export function usesTokenCompression(
  model: string,
  cfg: AnimaConfig = getRuntimeConfig(),
): boolean {
  return resolveUsesTokenCompression(cfg, model);
}
