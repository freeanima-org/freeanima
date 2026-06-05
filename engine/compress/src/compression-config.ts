import { loadConfig } from "@freeanima/legacy-kernel";
import type { NestConfig } from "@freeanima/legacy-kernel";

export type ModelConfig = {
  context_window?: number;
};

export type ResolvedCompressionConfig = {
  enabled: boolean;
  maxRounds: number;
  reservedTokens: number;
  triggerHigh: number;
  triggerLow: number;
  emergencyRatio: number;
  rawMinMessages: number;
  slimMinMessages: number;
  summaryMaxTokens: number;
};

const DEFAULT_RESERVED = 8192;

export function getCompressionConfig(): ResolvedCompressionConfig {
  const comp = loadConfig().compression ?? {};
  return {
    enabled: comp.enabled !== false,
    maxRounds: comp.max_rounds ?? 50,
    reservedTokens: comp.reserved_tokens ?? DEFAULT_RESERVED,
    triggerHigh: comp.trigger_high ?? 0.8,
    triggerLow: comp.trigger_low ?? 0.6,
    emergencyRatio: comp.emergency_ratio ?? 0.92,
    rawMinMessages: comp.raw_min_messages ?? 5,
    slimMinMessages: comp.slim_min_messages ?? 50,
    summaryMaxTokens: comp.summary_max_tokens ?? 4000,
  };
}

export function getModelsConfig(): Record<string, ModelConfig> {
  const cfg = loadConfig() as NestConfig & { models?: Record<string, ModelConfig> };
  const models = cfg.models;
  if (!models || typeof models !== "object") return {};
  return models;
}

/** 模型上下文窗口；未配置时返回 null（回退消息条数模式） */
export function getContextWindow(model: string): number | null {
  const models = getModelsConfig();
  const entry = models[model];
  if (entry?.context_window != null && entry.context_window > 0) {
    return entry.context_window;
  }
  const comp = loadConfig().compression ?? {};
  const fallback = (comp as { default_context_window?: number }).default_context_window;
  if (fallback != null && fallback > 0) return fallback;
  return null;
}

export function getEffectiveTokenBudget(model: string): number | null {
  const window = getContextWindow(model);
  if (window == null) return null;
  const { reservedTokens } = getCompressionConfig();
  return Math.max(4096, window - reservedTokens);
}

export function usesTokenCompression(model: string): boolean {
  return getEffectiveTokenBudget(model) != null;
}
