import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import type { SysRollKind } from "./buckets.ts";
import { asRecord } from "@freeanima/shared/util";

/** sys_roll TTL：与时间粒度对齐（不复用 peer_roll_ttl） */
export const SYS_ROLL_TTL_SECONDS: Record<SysRollKind, number> = {
  past_days: 24 * 60 * 60,
  past_months: 31 * 24 * 60 * 60,
  past_years: 366 * 24 * 60 * 60,
};

export function sysRollTtlSeconds(kind: SysRollKind): number {
  return SYS_ROLL_TTL_SECONDS[kind];
}

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

function configNum(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

function configStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function resolveTemporalSummaryConfig(cfg: RuntimeConfig): ResolvedTemporalSummaryConfig {
  const raw = asRecord(asRecord(cfg.memory)?.temporal_summary) ?? {};
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    chunk_max_chars: configNum(raw.chunk_max_chars, 50),
    peer_roll_max_chars: configNum(raw.peer_roll_max_chars, 100),
    global_day_max_chars: configNum(raw.global_day_max_chars, 100),
    month_max_chars: configNum(raw.month_max_chars, 100),
    year_max_chars: configNum(raw.year_max_chars, 100),
    system_prompt_max_chars: configNum(raw.system_prompt_max_chars, 1500),
    redis_key_prefix: configStr(raw.redis_key_prefix)?.trim() || "anima:temporal",
    peer_roll_ttl_seconds: configNum(raw.peer_roll_ttl_seconds, 36 * 60 * 60),
  };
}
