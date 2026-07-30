import { omitUndefined } from "@freeanima/host/core/util";
import type {
  AutoLlmMessageRow,
  AutoLlmRunRow,
} from "@freeanima/host/core/db/pg/auto-llm-run/types";
import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import {
  countAutoLlmRuns,
  getAutoLlmRun,
  listAutoLlmMessages,
  listAutoLlmRuns as listPgAutoLlmRuns,
} from "@freeanima/host/core/db/pg/auto-llm-run";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type AutoLlmRunListResult = {
  items: AutoLlmRunRow[];
  total: number;
  offset: number;
  limit: number;
};

export type AutoLlmRunGetResult = {
  run: AutoLlmRunRow;
  messages: AutoLlmMessageRow[];
};

function clampPagination(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Math.min(100, limit ?? 20));
  const safeOffset = Math.max(0, offset ?? 0);
  return { offset: safeOffset, limit: safeLimit };
}

export async function listAutoLlmRuns(
  _deps: RuntimeDeps,
  opts?: {
    run_kind?: string;
    status?: "ok" | "error";
    offset?: number;
    limit?: number;
  },
): Promise<AutoLlmRunListResult> {
  if (!isPostgresPrimary()) {
    return { items: [], total: 0, offset: 0, limit: opts?.limit ?? 20 };
  }

  const { offset, limit } = clampPagination(opts?.offset, opts?.limit);
  const filter = omitUndefined({
    run_kind: opts?.run_kind?.trim() || undefined,
    status: opts?.status,
  });
  const [items, total] = await Promise.all([
    listPgAutoLlmRuns({ ...filter, offset, limit }),
    countAutoLlmRuns(filter),
  ]);
  return { items, total, offset, limit };
}

export async function getAutoLlmRunDetail(
  _deps: RuntimeDeps,
  id: string,
): Promise<AutoLlmRunGetResult | null> {
  if (!isPostgresPrimary()) return null;
  const run = await getAutoLlmRun(id);
  if (!run) return null;
  const messages = await listAutoLlmMessages(id);
  return { run, messages };
}
