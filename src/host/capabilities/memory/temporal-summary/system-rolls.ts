import { listTemporalSummariesInRange } from "@freeanima/host/core/db/pg/temporal-summary";
import {
  cstDateString,
  monthPeriodStart,
  sysRollRedisKey,
  sysRollSourcesFp,
  yearPeriodStart,
  type SysRollKind,
} from "./buckets.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import { summarizeTemporalText, temporalSummaryHardCap } from "./summarize.ts";
import type { PeerRollCache } from "./tick.ts";

export type SysRollCacheValue = {
  summary: string;
  sources_fp: string;
  created_at: string;
};

export type SysRollSlot = {
  kind: SysRollKind;
  anchor: string;
  label: string;
  cache_hit: boolean;
  summary: string;
  sources_fp: string | null;
  created_at: string | null;
  source_count: number;
  redis_key: string;
};

function addCstDays(cstDate: string, delta: number): string {
  const parts = cstDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y == null || m == null || d == null) return cstDate;
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function materialRows(
  rows: Array<{ period_start: string; content: string }>,
): Array<{ period_start: string; content: string }> {
  return rows
    .toSorted((a, b) => a.period_start.localeCompare(b.period_start))
    .map((r) => ({ period_start: r.period_start, content: r.content.trim() }))
    .filter((r) => r.content.length > 0);
}

async function loadSourceRows(
  kind: SysRollKind,
  today: string,
): Promise<{
  anchor: string;
  label: string;
  rows: Array<{ period_start: string; content: string }>;
  instruction: string;
}> {
  const monthStart = monthPeriodStart(today);
  const yearStart = yearPeriodStart(today);
  if (kind === "past_days") {
    const from = monthStart;
    const to = addCstDays(today, -1);
    const rows =
      to < from
        ? []
        : await listTemporalSummariesInRange({
            window: "day",
            period_start_from: from,
            period_start_to: to,
          });
    return {
      anchor: today,
      label: `过往日（${from} … ${to < from ? "—" : to}）`,
      rows: rows.map((r) => ({ period_start: r.period_start, content: r.content })),
      instruction: `请将本月今天之前的全局天摘要合并为一条客观「过往日」合摘要：倒叙优先近期主题，一句级高度压缩。`,
    };
  }
  if (kind === "past_months") {
    const from = yearStart;
    const to = addCstDays(monthStart, -1);
    const toMonth = monthPeriodStart(to);
    const rows =
      to < from
        ? []
        : await listTemporalSummariesInRange({
            window: "month",
            period_start_from: from,
            period_start_to: toMonth,
          });
    return {
      anchor: today.slice(0, 7),
      label: `过往月（${from.slice(0, 7)} … ${to < from ? "—" : toMonth.slice(0, 7)}）`,
      rows: rows.map((r) => ({ period_start: r.period_start, content: r.content })),
      instruction: `请将今年本月以前的月摘要合并为一条客观「过往月」合摘要：倒叙优先近期主题，一句级高度压缩。`,
    };
  }
  const earlierYear = `${Number(yearStart.slice(0, 4)) - 1}-01-01`;
  const rows = await listTemporalSummariesInRange({
    window: "year",
    period_start_from: "1970-01-01",
    period_start_to: earlierYear,
  });
  return {
    anchor: today.slice(0, 4),
    label: `过往年（… ${earlierYear.slice(0, 4)}）`,
    rows: rows.map((r) => ({ period_start: r.period_start, content: r.content })),
    instruction: `请将今年以前的年摘要合并为一条客观「过往年」合摘要：倒叙优先近期主题，一句级高度压缩。`,
  };
}

async function resolveRollup(opts: {
  kind: SysRollKind;
  today: string;
  config: ResolvedTemporalSummaryConfig;
  peerCache?: PeerRollCache;
  selfContent?: string;
  force?: boolean;
}): Promise<{
  kind: SysRollKind;
  anchor: string;
  label: string;
  summary: string;
  sources_fp: string;
  created_at: string | null;
  source_count: number;
  cache_hit: boolean;
  redis_key: string;
}> {
  const loaded = await loadSourceRows(opts.kind, opts.today);
  const rows = materialRows(loaded.rows);
  const redis_key = sysRollRedisKey({
    prefix: opts.config.redis_key_prefix,
    kind: opts.kind,
    anchor: loaded.anchor,
  });
  const maxChars = opts.config.global_day_max_chars;
  const hardCap = temporalSummaryHardCap(maxChars);
  if (rows.length === 0) {
    return {
      kind: opts.kind,
      anchor: loaded.anchor,
      label: loaded.label,
      summary: "",
      sources_fp: "",
      created_at: null,
      source_count: 0,
      cache_hit: false,
      redis_key,
    };
  }
  const fp = sysRollSourcesFp(rows);

  if (!opts.force && opts.peerCache) {
    const hit = await opts.peerCache.getJson<SysRollCacheValue>(redis_key);
    const cached = hit?.summary?.trim() ?? "";
    if (cached && hit?.sources_fp === fp) {
      return {
        kind: opts.kind,
        anchor: loaded.anchor,
        label: loaded.label,
        summary: cached.slice(0, hardCap),
        sources_fp: fp,
        created_at: hit.created_at ?? null,
        source_count: rows.length,
        cache_hit: true,
        redis_key,
      };
    }
  }

  const material = rows.map((r) => `- ${r.period_start}: ${r.content}`).join("\n");
  let summary = "";
  try {
    if (!opts.selfContent?.trim()) {
      throw new Error("selfContent required for system rollup");
    }
    summary = await summarizeTemporalText({
      selfContent: opts.selfContent,
      instruction: loaded.instruction,
      material,
      maxChars,
    });
  } catch {
    summary = rows
      .toReversed()
      .map((r) => r.content)
      .join("；")
      .slice(0, hardCap);
  }
  summary = summary.trim().slice(0, hardCap);
  const created_at = new Date().toISOString();
  if (summary && opts.peerCache) {
    await opts.peerCache.setJson(
      redis_key,
      { summary, sources_fp: fp, created_at } satisfies SysRollCacheValue,
      opts.config.peer_roll_ttl_seconds,
    );
  }
  return {
    kind: opts.kind,
    anchor: loaded.anchor,
    label: loaded.label,
    summary,
    sources_fp: fp,
    created_at,
    source_count: rows.length,
    cache_hit: false,
    redis_key,
  };
}

const SYS_ROLL_KINDS: SysRollKind[] = ["past_days", "past_months", "past_years"];

/** Read-only list of three cache slots (no LLM). */
export async function listTemporalSystemRolls(opts: {
  config: ResolvedTemporalSummaryConfig;
  peerCache?: PeerRollCache;
  nowMs?: number;
}): Promise<{ items: SysRollSlot[] }> {
  const today = cstDateString(opts.nowMs ?? Date.now());
  const items: SysRollSlot[] = [];
  for (const kind of SYS_ROLL_KINDS) {
    const loaded = await loadSourceRows(kind, today);
    const rows = materialRows(loaded.rows);
    const redis_key = sysRollRedisKey({
      prefix: opts.config.redis_key_prefix,
      kind,
      anchor: loaded.anchor,
    });
    const fp = rows.length > 0 ? sysRollSourcesFp(rows) : "";
    const hit = opts.peerCache ? await opts.peerCache.getJson<SysRollCacheValue>(redis_key) : null;
    const cached = hit?.summary?.trim() ?? "";
    const cache_hit = Boolean(cached && (!fp || hit?.sources_fp === fp));
    items.push({
      kind,
      anchor: loaded.anchor,
      label: loaded.label,
      cache_hit,
      summary: cache_hit ? cached : "",
      sources_fp: cache_hit ? (hit?.sources_fp ?? null) : null,
      created_at: cache_hit ? (hit?.created_at ?? null) : null,
      source_count: rows.length,
      redis_key,
    });
  }
  return { items };
}

export async function regenerateTemporalSystemRoll(opts: {
  kind: SysRollKind;
  config: ResolvedTemporalSummaryConfig;
  selfContent: string;
  peerCache?: PeerRollCache;
  nowMs?: number;
}): Promise<SysRollSlot> {
  const today = cstDateString(opts.nowMs ?? Date.now());
  const result = await resolveRollup({
    kind: opts.kind,
    today,
    config: opts.config,
    selfContent: opts.selfContent,
    force: true,
    ...(opts.peerCache ? { peerCache: opts.peerCache } : {}),
  });
  return {
    kind: result.kind,
    anchor: result.anchor,
    label: result.label,
    cache_hit: false,
    summary: result.summary,
    sources_fp: result.sources_fp || null,
    created_at: result.created_at,
    source_count: result.source_count,
    redis_key: result.redis_key,
  };
}

export async function resolveAllSystemRolls(opts: {
  config: ResolvedTemporalSummaryConfig;
  peerCache?: PeerRollCache;
  selfContent?: string;
  nowMs?: number;
}): Promise<Array<{ label: string; summary: string }>> {
  const today = cstDateString(opts.nowMs ?? Date.now());
  const out: Array<{ label: string; summary: string }> = [];
  for (const kind of SYS_ROLL_KINDS) {
    const result = await resolveRollup({
      kind,
      today,
      config: opts.config,
      ...(opts.peerCache ? { peerCache: opts.peerCache } : {}),
      ...(opts.selfContent !== undefined ? { selfContent: opts.selfContent } : {}),
    });
    if (result.summary) {
      out.push({ label: result.label, summary: result.summary });
    }
  }
  return out;
}
