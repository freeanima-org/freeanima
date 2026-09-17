import type { RuntimeConfig } from "./schemas/runtime-config.ts";

export type ResolvedCompressionConfig = {
  enabled: boolean;
  maxMessagePairs: number;
  reservedTokens: number;
  triggerHigh: number;
  triggerLow: number;
  emergencyRatio: number;
  rawMinMessages: number;
  slimMinMessages: number;
  summaryMaxTokens: number;
};

const DEFAULT_RESERVED = 8192;

export function getCompressionConfig(cfg: RuntimeConfig): ResolvedCompressionConfig {
  const comp = cfg.compression ?? {};
  return {
    enabled: comp.enabled !== false,
    maxMessagePairs: comp.max_message_pairs ?? 50,
    reservedTokens: comp.reserved_tokens ?? DEFAULT_RESERVED,
    triggerHigh: comp.trigger_high ?? 0.8,
    triggerLow: comp.trigger_low ?? 0.6,
    emergencyRatio: comp.emergency_ratio ?? 0.92,
    rawMinMessages: comp.raw_min_messages ?? 5,
    slimMinMessages: comp.slim_min_messages ?? 50,
    summaryMaxTokens: comp.summary_max_tokens ?? 4000,
  };
}

/** Only Provider catalog (models.dev enrich / defaults); null → message-count mode. */
export type ContextWindowSource = "catalog";

export type ResolvedContextWindow = {
  window: number | null;
  source: ContextWindowSource | null;
};

/** Resolve context window from Provider catalog value. */
export function resolveContextWindowWithSource(
  catalogWindow?: number | null,
): ResolvedContextWindow {
  if (catalogWindow != null && catalogWindow > 0) {
    return { window: catalogWindow, source: "catalog" };
  }
  return { window: null, source: null };
}

/** Model context window; null when unset (fallback to message-count mode) */
export function getContextWindow(catalogWindow?: number | null): number | null {
  return resolveContextWindowWithSource(catalogWindow).window;
}

export function budgetFromContextWindow(cfg: RuntimeConfig, window: number): number {
  const { reservedTokens } = getCompressionConfig(cfg);
  return Math.max(4096, window - reservedTokens);
}

export function getEffectiveTokenBudget(
  cfg: RuntimeConfig,
  catalogWindow?: number | null,
): number | null {
  const window = getContextWindow(catalogWindow);
  if (window == null) return null;
  return budgetFromContextWindow(cfg, window);
}

export function usesTokenCompression(cfg: RuntimeConfig, catalogWindow?: number | null): boolean {
  return getEffectiveTokenBudget(cfg, catalogWindow) != null;
}
