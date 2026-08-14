import type { RuntimeConfig } from "@freeanima/habitat/core/config";

export type ResolvedTemporalSummaryConfig = {
  enabled: boolean;
  chunk_max_chars: number;
  peer_roll_max_chars: number;
  global_day_max_chars: number;
  month_max_chars: number;
  year_max_chars: number;
  system_prompt_max_chars: number;
  redis_key_prefix: string;
  peer_roll_ttl_seconds: number;
};

export type TemporalSummaryConfigInput = {
  enabled?: boolean;
  chunk_max_chars?: number;
  peer_roll_max_chars?: number;
  global_day_max_chars?: number;
  month_max_chars?: number;
  year_max_chars?: number;
  system_prompt_max_chars?: number;
  redis_key_prefix?: string;
  peer_roll_ttl_seconds?: number;
};

export function resolveTemporalSummaryConfig(cfg: RuntimeConfig): ResolvedTemporalSummaryConfig {
  const raw = (cfg.memory as { temporal_summary?: TemporalSummaryConfigInput } | undefined)
    ?.temporal_summary;
  return {
    enabled: raw?.enabled ?? true,
    chunk_max_chars: raw?.chunk_max_chars ?? 50,
    peer_roll_max_chars: raw?.peer_roll_max_chars ?? 100,
    global_day_max_chars: raw?.global_day_max_chars ?? 100,
    month_max_chars: raw?.month_max_chars ?? 100,
    year_max_chars: raw?.year_max_chars ?? 100,
    system_prompt_max_chars: raw?.system_prompt_max_chars ?? 1500,
    redis_key_prefix: raw?.redis_key_prefix?.trim() || "anima:temporal",
    peer_roll_ttl_seconds: raw?.peer_roll_ttl_seconds ?? 36 * 60 * 60,
  };
}
