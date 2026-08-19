import { omitUndefined } from "@freeanima/habitat/core/util";
import type {
  AutoLlmMessageRow,
  AutoLlmRunRow,
} from "@freeanima/habitat/core/db/pg/auto-llm-run/types";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import {
  countAutoLlmRuns,
  getAutoLlmRun,
  listAutoLlmMessages,
  listAutoLlmRuns as listPgAutoLlmRuns,
  sumAutoLlmUsageByRunIds,
  sumAutoLlmUsageFiltered,
} from "@freeanima/habitat/core/db/pg/auto-llm-run";
import { emptyLlmUsageTotals, type LlmUsageTotals } from "@freeanima/shared/llm-usage";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type AutoLlmRunWithUsage = AutoLlmRunRow & { usage: LlmUsageTotals };

export type AutoLlmRunListResult = {
  items: AutoLlmRunWithUsage[];
  total: number;
  offset: number;
  limit: number;
  usage_totals: LlmUsageTotals;
};

export type AutoLlmRunGetResult = {
  run: AutoLlmRunWithUsage;
  messages: AutoLlmMessageRow[];
};

function clampPagination(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Math.min(100, limit ?? 20));
  const safeOffset = Math.max(0, offset ?? 0);
  return { offset: safeOffset, limit: safeLimit };
}

function withUsage(row: AutoLlmRunRow, usage: LlmUsageTotals | undefined): AutoLlmRunWithUsage {
  return { ...row, usage: usage ?? emptyLlmUsageTotals() };
}

export async function listAutoLlmRuns(
  _deps: RuntimeDeps,
  opts?: {
    run_kind?: string;
    status?: "running" | "ok" | "error";
    offset?: number;
    limit?: number;
  },
): Promise<AutoLlmRunListResult> {
  if (!isPostgresPrimary()) {
    return {
      items: [],
      total: 0,
      offset: 0,
      limit: opts?.limit ?? 20,
      usage_totals: emptyLlmUsageTotals(),
    };
  }

  const { offset, limit } = clampPagination(opts?.offset, opts?.limit);
  const filter = omitUndefined({
    run_kind: opts?.run_kind?.trim() || undefined,
    status: opts?.status,
  });
  const [items, total, usage_totals] = await Promise.all([
    listPgAutoLlmRuns({ ...filter, offset, limit }),
    countAutoLlmRuns(filter),
    sumAutoLlmUsageFiltered(filter),
  ]);
  const usageById = await sumAutoLlmUsageByRunIds(items.map((row) => row.id));
  return {
    items: items.map((row) => withUsage(row, usageById.get(row.id))),
    total,
    offset,
    limit,
    usage_totals,
  };
}

export async function getAutoLlmRunDetail(
  _deps: RuntimeDeps,
  id: string,
): Promise<AutoLlmRunGetResult | null> {
  if (!isPostgresPrimary()) return null;
  const run = await getAutoLlmRun(id);
  if (!run) return null;
  const [messages, usageById] = await Promise.all([
    listAutoLlmMessages(id),
    sumAutoLlmUsageByRunIds([id]),
  ]);
  return { run: withUsage(run, usageById.get(id)), messages };
}
