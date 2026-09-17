import type { RuntimeConfig } from "../config/schemas/runtime-config.ts";
import { getActiveRuntimeConfig } from "../config/config-store.ts";
import {
  getCompressionConfig as resolveCompressionConfig,
  getContextWindow as resolveContextWindow,
  getEffectiveTokenBudget as resolveEffectiveTokenBudget,
  usesTokenCompression as resolveUsesTokenCompression,
  type ResolvedCompressionConfig,
} from "../config/compression-config.ts";

export type { ResolvedCompressionConfig };

function activeData(): RuntimeConfig {
  return getActiveRuntimeConfig().data;
}

export function getCompressionConfig(cfg: RuntimeConfig = activeData()): ResolvedCompressionConfig {
  return resolveCompressionConfig(cfg);
}

export function getContextWindow(catalogWindow?: number | null): number | null {
  return resolveContextWindow(catalogWindow);
}

export function getEffectiveTokenBudget(
  catalogWindow?: number | null,
  cfg: RuntimeConfig = activeData(),
): number | null {
  return resolveEffectiveTokenBudget(cfg, catalogWindow);
}

export function usesTokenCompression(
  catalogWindow?: number | null,
  cfg: RuntimeConfig = activeData(),
): boolean {
  return resolveUsesTokenCompression(cfg, catalogWindow);
}
