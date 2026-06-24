import type { AutoLlmRunRow } from "@freeanima/core/repos";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type AutoLlmRunListResult = {
  items: AutoLlmRunRow[];
  total: number;
  offset: number;
  limit: number;
};

function clampPagination(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Math.min(100, limit ?? 20));
  const safeOffset = Math.max(0, offset ?? 0);
  return { offset: safeOffset, limit: safeLimit };
}

export async function listAutoLlmRuns(
  deps: RuntimeDeps,
  opts?: {
    run_kind?: string;
    status?: "ok" | "error";
    offset?: number;
    limit?: number;
  },
): Promise<AutoLlmRunListResult> {
  if (!deps.engine.repos.pgAvailable) {
    return { items: [], total: 0, offset: 0, limit: opts?.limit ?? 20 };
  }

  const { offset, limit } = clampPagination(opts?.offset, opts?.limit);
  const filter = {
    run_kind: opts?.run_kind?.trim() || undefined,
    status: opts?.status,
  };
  const [items, total] = await Promise.all([
    deps.engine.repos.autoLlmRun.list({ ...filter, offset, limit }),
    deps.engine.repos.autoLlmRun.count(filter),
  ]);
  return { items, total, offset, limit };
}
