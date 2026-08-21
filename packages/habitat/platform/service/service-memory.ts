import type { SemanticFtsHit } from "@freeanima/habitat/core/db/schema/rows";
import type { SemanticMemorySearchOpts } from "@freeanima/habitat/core/db/pg/semantic-memory/types";
import {
  countSemanticMemory,
  countSemanticMemorySearch,
  getSemanticMemory,
  searchSemanticMemory,
  updateSemanticMemory,
} from "@freeanima/habitat/core/db/pg/semantic-memory";
import {
  listTemporalSummaries,
  listTemporalSummariesInRange,
} from "@freeanima/habitat/core/db/pg/temporal-summary";
import type { TemporalSummaryWindow } from "@freeanima/habitat/core/db/schema/entity/components/temporal-summary";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { cacheGetJson, cacheSetJson } from "@freeanima/habitat/core/redis";
import {
  runPassiveRecallDebug,
  type PassiveRecallDebugResult,
} from "@freeanima/habitat/capabilities/memory/passive-recall/debug-run.ts";
import {
  clampTemporalBackfillRange,
  getTemporalBatchJobStatus,
  getTemporalSystemRollBatchJobStatus,
  listExpectedPeriodStarts,
  listMissingPeriodStarts,
  listTemporalSystemRolls,
  regenerateTemporalSystemRoll,
  rebuildMonthSummary,
  rebuildYearSummary,
  resolveTemporalSummaryConfig,
  runTemporalSummaryDay,
  startTemporalBatchJob,
  startTemporalSystemRollBatchJob,
  ALL_SYS_ROLL_KINDS,
  type SysRollKind,
  type TemporalBatchJobStatus,
  type TemporalSystemRollBatchJobStatus,
} from "@freeanima/habitat/capabilities/memory/temporal-summary";
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
  agent_subject_id?: number;
}) {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  let world_id: number | undefined;
  if (args.agent_subject_id != null) {
    const { resolvePrivateWorldId } =
      await import("@freeanima/habitat/core/config/world-context-pg.ts");
    world_id = await resolvePrivateWorldId(args.agent_subject_id);
  }
  const result = await listTemporalSummaries(
    omitUndefined({
      window: args.window,
      period_start_from: args.period_start_from,
      period_start_to: args.period_start_to,
      offset,
      limit,
      world_id,
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
  const { listEnabledBoundAgents } =
    await import("@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts");
  const agents = await listEnabledBoundAgents();
  if (agents.length === 0) {
    return {
      ok: true,
      window: args.window,
      period_start: args.period_start,
      entity_id: null,
      summary: "no_agents",
      skipped: "no_agents",
    };
  }
  if (args.window === "day") {
    const results = [];
    for (const agent of agents) {
      results.push(
        await runTemporalSummaryDay({
          config,
          day: args.period_start,
          agent_subject_id: agent.agent_subject_id,
          world_id: agent.agent_world_id,
        }),
      );
    }
    const ok = results.every((r) => r.ok);
    return {
      ok,
      window: "day" as const,
      period_start: args.period_start,
      entity_id: results[0]?.entity_id ?? null,
      summary: results.map((r) => r.summary).join("; "),
      skipped: results.every((r) => r.skipped) ? (results[0]?.skipped ?? null) : null,
    };
  }
  if (args.window === "month") {
    const results = [];
    for (const agent of agents) {
      results.push(
        await rebuildMonthSummary({
          config,
          period_start: args.period_start,
          agent_subject_id: agent.agent_subject_id,
          world_id: agent.agent_world_id,
        }),
      );
    }
    const ok = results.every((r) => r.ok);
    return {
      ok,
      window: "month" as const,
      period_start: args.period_start,
      entity_id: results[0]?.entity_id ?? null,
      summary: results.map((r) => r.summary).join("; "),
      skipped: results.every((r) => r.skipped) ? (results[0]?.skipped ?? null) : null,
    };
  }
  const results = [];
  for (const agent of agents) {
    results.push(
      await rebuildYearSummary({
        config,
        period_start: args.period_start,
        agent_subject_id: agent.agent_subject_id,
        world_id: agent.agent_world_id,
      }),
    );
  }
  const ok = results.every((r) => r.ok);
  return {
    ok,
    window: "year" as const,
    period_start: args.period_start,
    entity_id: results[0]?.entity_id ?? null,
    summary: results.map((r) => r.summary).join("; "),
    skipped: results.every((r) => r.skipped) ? (results[0]?.skipped ?? null) : null,
  };
}

export async function backfillMissingTemporalSummaries(args: {
  window: TemporalSummaryWindow;
  period_start_from: string;
  period_start_to: string;
}): Promise<TemporalBatchJobStatus> {
  const fromRaw = args.period_start_from;
  const toRaw = args.period_start_to;
  if (fromRaw > toRaw) {
    return {
      running: false,
      mode: "backfill_missing",
      window: args.window,
      period_start_from: fromRaw,
      period_start_to: toRaw,
      current: 0,
      total: 0,
      current_period: null,
      completed: [],
      failed: [],
      started_at: null,
      finished_at: new Date().toISOString(),
      error: "period_start_from must be <= period_start_to",
      summary: "period_start_from must be <= period_start_to",
    };
  }
  const clamped = clampTemporalBackfillRange({ from: fromRaw, to: toRaw });
  if (!clamped) {
    return startTemporalBatchJob({
      mode: "backfill_missing",
      window: args.window,
      period_start_from: fromRaw,
      period_start_to: toRaw,
      periods: [],
      regenerateOne: regenerateOneTemporalSummary,
      summaryNote: " (range entirely after CST today; skip)",
    });
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
  const clampNote = clamped.clamped ? ` (capped to CST today ${clamped.today})` : "";
  return startTemporalBatchJob({
    mode: "backfill_missing",
    window: args.window,
    period_start_from: from,
    period_start_to: to,
    periods: missing,
    regenerateOne: regenerateOneTemporalSummary,
    summaryNote: clampNote,
  });
}

/** Force-regenerate every expected period in [from, to] (including existing empty rows). */
export async function rebuildTemporalSummariesInRange(args: {
  window: TemporalSummaryWindow;
  period_start_from: string;
  period_start_to: string;
}): Promise<TemporalBatchJobStatus> {
  const fromRaw = args.period_start_from;
  const toRaw = args.period_start_to;
  if (fromRaw > toRaw) {
    return {
      running: false,
      mode: "rebuild_range",
      window: args.window,
      period_start_from: fromRaw,
      period_start_to: toRaw,
      current: 0,
      total: 0,
      current_period: null,
      completed: [],
      failed: [],
      started_at: null,
      finished_at: new Date().toISOString(),
      error: "period_start_from must be <= period_start_to",
      summary: "period_start_from must be <= period_start_to",
    };
  }
  const clamped = clampTemporalBackfillRange({ from: fromRaw, to: toRaw });
  if (!clamped) {
    return startTemporalBatchJob({
      mode: "rebuild_range",
      window: args.window,
      period_start_from: fromRaw,
      period_start_to: toRaw,
      periods: [],
      regenerateOne: regenerateOneTemporalSummary,
      summaryNote: " (range entirely after CST today; skip)",
    });
  }
  const { from, to } = clamped;
  const expected = listExpectedPeriodStarts(args.window, from, to);
  const clampNote = clamped.clamped ? ` (capped to CST today ${clamped.today})` : "";
  return startTemporalBatchJob({
    mode: "rebuild_range",
    window: args.window,
    period_start_from: from,
    period_start_to: to,
    periods: expected,
    regenerateOne: regenerateOneTemporalSummary,
    summaryNote: clampNote,
  });
}

export function getTemporalSummaryBatchJobStatus(): TemporalBatchJobStatus {
  return getTemporalBatchJobStatus();
}

async function regenerateOneTemporalSummary(args: {
  window: TemporalSummaryWindow;
  period_start: string;
}): Promise<{ ok: boolean; summary: string }> {
  const result = await regenerateTemporalSummary(args);
  return { ok: result.ok, summary: result.summary };
}

export async function listTemporalSystemRollMemories() {
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  return listTemporalSystemRolls({ config, peerCache: peerCache() });
}

export async function regenerateTemporalSystemRollMemory(args: { kind: SysRollKind }) {
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  const item = await regenerateTemporalSystemRoll({
    kind: args.kind,
    config,
    peerCache: peerCache(),
  });
  return { ok: true as const, item };
}

/** Start async system-roll batch; returns job status immediately. */
export function startTemporalSystemRollBatch(args?: {
  kinds?: SysRollKind[];
}): TemporalSystemRollBatchJobStatus {
  const kinds = args?.kinds?.length ? args.kinds : ALL_SYS_ROLL_KINDS;
  return startTemporalSystemRollBatchJob({
    kinds,
    regenerateOne: async (kind) => {
      const result = await regenerateTemporalSystemRollMemory({ kind });
      return { ok: result.ok, summary: result.item.summary };
    },
  });
}

export function getTemporalSystemRollBatchStatus(): TemporalSystemRollBatchJobStatus {
  return getTemporalSystemRollBatchJobStatus();
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
    cluster_id?: number | null;
    agent_subject_id?: number;
  } = {},
): Promise<MemoryListResult<SemanticFtsHit>> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const sourceSession = args.source_conversation?.trim();
  let world_id: number | undefined;
  if (args.agent_subject_id != null) {
    const { resolvePrivateWorldId } =
      await import("@freeanima/habitat/core/config/world-context-pg.ts");
    world_id = await resolvePrivateWorldId(args.agent_subject_id);
  }
  const filterOpts: Omit<SemanticMemorySearchOpts, "limit" | "offset"> = omitUndefined({
    query: args.query,
    types: args.types,
    status: args.status,
    source_conversations: sourceSession ? [sourceSession] : undefined,
    sort_by: args.sort_by,
    cluster_id: args.cluster_id,
    world_id,
  });
  const [items, total] = await Promise.all([
    searchSemanticMemory({ ...filterOpts, offset, limit }),
    countSemanticMemorySearch(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function listSemanticMemoryClusters(
  _deps: RuntimeDeps,
): Promise<{ items: Array<{ cluster_id: number | null; count: number; title: string | null }> }> {
  const { listSemanticMemoryClusterStats } =
    await import("@freeanima/habitat/core/db/pg/search/clustering-repo.ts");
  const { peekSemanticClusterTitle } =
    await import("@freeanima/habitat/capabilities/memory/clustering/cluster-title.ts");
  const stats = await listSemanticMemoryClusterStats({ status: "active" });
  const items: Array<{ cluster_id: number | null; count: number; title: string | null }> = [];
  for (const row of stats) {
    let title: string | null = null;
    if (row.cluster_id != null) {
      try {
        title = await peekSemanticClusterTitle(row.cluster_id);
      } catch {
        title = null;
      }
    }
    items.push({ cluster_id: row.cluster_id, count: row.count, title });
  }
  return { items };
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
