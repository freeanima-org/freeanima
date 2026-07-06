import type { AnimaConfig } from "./schemas/config.ts";

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

export function getCompressionConfig(cfg: AnimaConfig): ResolvedCompressionConfig {
  const comp = cfg.compression ?? {};
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

export function getModelsConfig(cfg: AnimaConfig): Record<string, ModelConfig> {
  const models = (cfg as AnimaConfig & { models?: Record<string, ModelConfig> }).models;
  if (!models || typeof models !== "object") return {};
  return models;
}

export type ContextWindowSource = "config" | "default" | "catalog";

export type ResolvedContextWindow = {
  window: number | null;
  source: ContextWindowSource | null;
};

export type ContextWindowResolveOpts = {
  catalogFallback?: number | null;
};

/** Resolve context window with source label (config > default > catalog > null) */
export function resolveContextWindowWithSource(
  cfg: AnimaConfig,
  model: string,
  opts?: ContextWindowResolveOpts,
): ResolvedContextWindow {
  const models = getModelsConfig(cfg);
  const entry = models[model];
  if (entry?.context_window != null && entry.context_window > 0) {
    return { window: entry.context_window, source: "config" };
  }
  const fallback = cfg.compression?.default_context_window;
  if (fallback != null && fallback > 0) {
    return { window: fallback, source: "default" };
  }
  const catalog = opts?.catalogFallback;
  if (catalog != null && catalog > 0) {
    return { window: catalog, source: "catalog" };
  }
  return { window: null, source: null };
}

/** Model context window; null when unset (fallback to message-count mode) */
export function getContextWindow(
  cfg: AnimaConfig,
  model: string,
  opts?: ContextWindowResolveOpts,
): number | null {
  return resolveContextWindowWithSource(cfg, model, opts).window;
}

export function budgetFromContextWindow(cfg: AnimaConfig, window: number): number {
  const { reservedTokens } = getCompressionConfig(cfg);
  return Math.max(4096, window - reservedTokens);
}

export function getEffectiveTokenBudget(
  cfg: AnimaConfig,
  model: string,
  opts?: ContextWindowResolveOpts,
): number | null {
  const window = getContextWindow(cfg, model, opts);
  if (window == null) return null;
  return budgetFromContextWindow(cfg, window);
}

export function usesTokenCompression(
  cfg: AnimaConfig,
  model: string,
  opts?: ContextWindowResolveOpts,
): boolean {
  return getEffectiveTokenBudget(cfg, model, opts) != null;
}
