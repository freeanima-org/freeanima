import type { AutobiographicalListOpts } from "@freeanima/host/core/db/pg/autobiographical-memory/types";
import type {
  AutobiographicalMemoryRow,
  LimbicMemoryRow,
  SemanticFtsHit,
} from "@freeanima/host/core/db/schema/rows";
import type { LimbicListOpts } from "@freeanima/host/core/db/pg/limbic-memory/types";
import type { SemanticMemorySearchOpts } from "@freeanima/host/core/db/pg/semantic-memory/types";
import {
  countAutobiographicalMemory,
  listAutobiographicalMemory,
} from "@freeanima/host/core/db/pg/autobiographical-memory";
import { countLimbicMemory, listLimbicMemory } from "@freeanima/host/core/db/pg/limbic-memory";
import {
  countSemanticMemory,
  countSemanticMemorySearch,
  getSemanticMemory,
  searchSemanticMemory,
  updateSemanticMemory,
} from "@freeanima/host/core/db/pg/semantic-memory";
import {
  listTemporalSummaries,
  listTemporalSummariesInRange,
} from "@freeanima/host/core/db/pg/temporal-summary";
import type { TemporalSummaryWindow } from "@freeanima/host/core/db/schema/entity/components/temporal-summary";
import { omitUndefined } from "@freeanima/host/core/util";
import { getActiveRuntimeConfig } from "@freeanima/host/core/config";
import { cacheGetJson, cacheSetJson } from "@freeanima/host/core/redis";
import { loadSelfLayerPrompt } from "@freeanima/host/capabilities/self";
import {
  runPassiveRecallDebug,
  type PassiveRecallDebugResult,
} from "@freeanima/host/capabilities/memory/passive-recall/debug-run.ts";
import {
  clampTemporalBackfillRange,
  listExpectedPeriodStarts,
  listMissingPeriodStarts,
  listTemporalSystemRolls,
  regenerateTemporalSystemRoll,
  rebuildMonthSummary,
  rebuildYearSummary,
  resolveTemporalSummaryConfig,
  runTemporalSummaryDay,
  type SysRollKind,
} from "@freeanima/host/capabilities/memory/temporal-summary";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type MemoryListResult<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

function clampPagination(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Math.min(100, limit ?? 20));
  const safeOffset = Math.max(0, offset ?? 0);
  return { offset: safeOffset, limit: safeLimit };
}

export async function passiveRecallDebug(args: {
  user_text: string;
  limit?: number;
}): Promise<PassiveRecallDebugResult> {
  return runPassiveRecallDebug({
    user_text: args.user_text,
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
  });
}

export async function listTemporalSummaryMemories(args: {
  window?: TemporalSummaryWindow;
  period_start_from?: string;
  period_start_to?: string;
  offset?: number;
  limit?: number;
}) {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const result = await listTemporalSummaries(
    omitUndefined({
      window: args.window,
      period_start_from: args.period_start_from,
      period_start_to: args.period_start_to,
      offset,
      limit,
    }),
  );
  return {
    items: result.items.map((row) => ({
      ...row,
      updated_at: row.updated_at.toISOString(),
      content_chars: row.content.length,
    })),
    total: result.total,
    offset,
    limit,
  };
}

function peerCache() {
  return {
    getJson: cacheGetJson,
    setJson: cacheSetJson,
  };
}

export async function regenerateTemporalSummary(args: {
  window: TemporalSummaryWindow;
  period_start: string;
}) {
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  const selfContent = await loadSelfLayerPrompt();
  if (args.window === "day") {
    const result = await runTemporalSummaryDay({
      selfContent,
      config,
      day: args.period_start,
    });
    return {
      ok: result.ok,
      window: "day" as const,
      period_start: args.period_start,
      entity_id: result.entity_id ?? null,
      summary: result.summary,
      skipped: result.skipped ?? null,
    };
  }
  if (args.window === "month") {
    const result = await rebuildMonthSummary({
      selfContent,
      config,
      period_start: args.period_start,
    });
    return {
      ok: result.ok,
      window: "month" as const,
      period_start: args.period_start,
      entity_id: result.entity_id ?? null,
      summary: result.summary,
      skipped: result.skipped ?? null,
    };
  }
  const result = await rebuildYearSummary({
    selfContent,
    config,
    period_start: args.period_start,
  });
  return {
    ok: result.ok,
    window: "year" as const,
    period_start: args.period_start,
    entity_id: result.entity_id ?? null,
    summary: result.summary,
    skipped: result.skipped ?? null,
  };
}

export async function backfillMissingTemporalSummaries(args: {
  window: TemporalSummaryWindow;
  period_start_from: string;
  period_start_to: string;
}) {
  const fromRaw = args.period_start_from;
  const toRaw = args.period_start_to;
  if (fromRaw > toRaw) {
    return {
      ok: false as const,
      window: args.window,
      period_start_from: fromRaw,
      period_start_to: toRaw,
      missing: [] as string[],
      filled: [] as string[],
      failed: [] as Array<{ period_start: string; summary: string }>,
      summary: "period_start_from must be <= period_start_to",
    };
  }
  const clamped = clampTemporalBackfillRange({ from: fromRaw, to: toRaw });
  if (!clamped) {
    return {
      ok: true as const,
      window: args.window,
      period_start_from: fromRaw,
      period_start_to: toRaw,
      missing: [] as string[],
      filled: [] as string[],
      failed: [] as Array<{ period_start: string; summary: string }>,
      summary: "range is entirely after CST today; skip future backfill",
    };
  }
  const { from, to } = clamped;
  const existing = await listTemporalSummariesInRange({
    window: args.window,
    period_start_from: from,
    period_start_to: to,
  });
  const missing = listMissingPeriodStarts({
    window: args.window,
    from,
    to,
    today: clamped.today,
    existing: new Set(existing.map((r) => r.period_start)),
  });
  const filled: string[] = [];
  const failed: Array<{ period_start: string; summary: string }> = [];
  for (const period_start of missing) {
    const result = await regenerateTemporalSummary({
      window: args.window,
      period_start,
    });
    if (!result.ok) {
      failed.push({ period_start, summary: result.summary });
      continue;
    }
    filled.push(period_start);
  }
  const clampNote = clamped.clamped ? ` (capped to CST today ${clamped.today})` : "";
  return {
    ok: failed.length === 0,
    window: args.window,
    period_start_from: from,
    period_start_to: to,
    missing,
    filled,
    failed,
    summary: `missing=${missing.length} filled=${filled.length} failed=${failed.length}${clampNote}`,
  };
}

/** Force-regenerate every expected period in [from, to] (including existing empty rows). */
export async function rebuildTemporalSummariesInRange(args: {
  window: TemporalSummaryWindow;
  period_start_from: string;
  period_start_to: string;
}) {
  const fromRaw = args.period_start_from;
  const toRaw = args.period_start_to;
  if (fromRaw > toRaw) {
    return {
      ok: false as const,
      window: args.window,
      period_start_from: fromRaw,
      period_start_to: toRaw,
      expected: [] as string[],
      filled: [] as string[],
      failed: [] as Array<{ period_start: string; summary: string }>,
      summary: "period_start_from must be <= period_start_to",
    };
  }
  const clamped = clampTemporalBackfillRange({ from: fromRaw, to: toRaw });
  if (!clamped) {
    return {
      ok: true as const,
      window: args.window,
      period_start_from: fromRaw,
      period_start_to: toRaw,
      expected: [] as string[],
      filled: [] as string[],
      failed: [] as Array<{ period_start: string; summary: string }>,
      summary: "range is entirely after CST today; skip future rebuild",
    };
  }
  const { from, to } = clamped;
  const expected = listExpectedPeriodStarts(args.window, from, to);
  const filled: string[] = [];
  const failed: Array<{ period_start: string; summary: string }> = [];
  for (const period_start of expected) {
    const result = await regenerateTemporalSummary({
      window: args.window,
      period_start,
    });
    if (!result.ok) {
      failed.push({ period_start, summary: result.summary });
      continue;
    }
    filled.push(period_start);
  }
  const clampNote = clamped.clamped ? ` (capped to CST today ${clamped.today})` : "";
  return {
    ok: failed.length === 0,
    window: args.window,
    period_start_from: from,
    period_start_to: to,
    expected,
    filled,
    failed,
    summary: `expected=${expected.length} filled=${filled.length} failed=${failed.length}${clampNote}`,
  };
}

export async function listTemporalSystemRollMemories() {
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  return listTemporalSystemRolls({ config, peerCache: peerCache() });
}

export async function regenerateTemporalSystemRollMemory(args: { kind: SysRollKind }) {
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  const selfContent = await loadSelfLayerPrompt();
  const item = await regenerateTemporalSystemRoll({
    kind: args.kind,
    config,
    selfContent,
    peerCache: peerCache(),
  });
  return { ok: true as const, item };
}

/** PG STORED content_fts auto-maintained; returns semantic_memory row count */
export async function countSemanticMemoryRows(_deps: RuntimeDeps): Promise<{ index_rows: number }> {
  const count = await countSemanticMemory();
  return { index_rows: count };
}

export async function listSemanticMemories(
  _deps: RuntimeDeps,
  args: {
    query?: string;
    offset?: number;
    limit?: number;
    types?: string[];
    status?: SemanticMemorySearchOpts["status"];
    source_conversation?: string;
    sort_by?: SemanticMemorySearchOpts["sort_by"];
  } = {},
): Promise<MemoryListResult<SemanticFtsHit>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const sourceSession = args.source_conversation?.trim();
  const filterOpts: Omit<SemanticMemorySearchOpts, "limit" | "offset"> = omitUndefined({
    query: args.query,
    types: args.types,
    status: args.status,
    source_conversations: sourceSession ? [sourceSession] : undefined,
    sort_by: args.sort_by,
  });
  const [items, total] = await Promise.all([
    searchSemanticMemory({ ...filterOpts, offset, limit }),
    countSemanticMemorySearch(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function updateSemanticMemoryPinned(
  _deps: RuntimeDeps,
  id: number | string,
  pinned: boolean,
): Promise<{ ok: true; id: number; pinned: boolean }> {
  const existing = await getSemanticMemory(id);
  if (!existing) throw new Error(`Memory not found: ${id}`);
  if (existing.status !== "active") {
    throw new Error(`Only active memories can be pinned: ${id}`);
  }

  await updateSemanticMemory({ id: existing.id, pinned });
  return { ok: true, id: existing.id, pinned };
}

export async function listLimbicMemories(
  _deps: RuntimeDeps,
  args: LimbicListOpts = {},
): Promise<MemoryListResult<LimbicMemoryRow>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts: Omit<LimbicListOpts, "offset" | "limit"> = omitUndefined({
    query: args.query,
    conversation_id: args.conversation_id,
    kind: args.kind,
  });
  const [items, total] = await Promise.all([
    listLimbicMemory({ ...filterOpts, offset, limit }),
    countLimbicMemory(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function listAutobiographicalMemories(
  _deps: RuntimeDeps,
  args: AutobiographicalListOpts = {},
): Promise<MemoryListResult<AutobiographicalMemoryRow>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts: Omit<AutobiographicalListOpts, "offset" | "limit"> = omitUndefined({
    query: args.query,
    status: args.status,
    significance: args.significance,
    source_conversation: args.source_conversation,
  });
  const [items, total] = await Promise.all([
    listAutobiographicalMemory({ ...filterOpts, offset, limit }),
    countAutobiographicalMemory(filterOpts),
  ]);
  return { items, total, offset, limit };
}
