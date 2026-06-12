import type { AnimaConfig } from "@freeanima/storage-config";
import { getActiveConfig } from "@freeanima/storage-config";
import {
  getCompressionConfig as resolveCompressionConfig,
  getContextWindow as resolveContextWindow,
  getEffectiveTokenBudget as resolveEffectiveTokenBudget,
  getModelsConfig as resolveModelsConfig,
  usesTokenCompression as resolveUsesTokenCompression,
  type ModelConfig,
  type ResolvedCompressionConfig,
} from "@freeanima/storage-config";

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

export function getContextWindow(model: string, cfg: AnimaConfig = activeData()): number | null {
  return resolveContextWindow(cfg, model);
}

export function getEffectiveTokenBudget(
  model: string,
  cfg: AnimaConfig = activeData(),
): number | null {
  return resolveEffectiveTokenBudget(cfg, model);
}

export function usesTokenCompression(model: string, cfg: AnimaConfig = activeData()): boolean {
  return resolveUsesTokenCompression(cfg, model);
}
