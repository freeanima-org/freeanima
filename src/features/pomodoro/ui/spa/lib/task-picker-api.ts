/// <reference lib="dom" />
import { getSubjectKind } from "@freeanima/frontend/shell-sdk/subject-scope-store.ts";
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export type PomodoroTaskPickRow = {
  id: number;
  title: string;
  status: "pending" | "completed";
  updated_at: string;
};

const PICK_LIMIT = 10;

function hub() {
  return getBundledHubClient({ profile: "satellite" });
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

function sortByUpdatedDesc(items: PomodoroTaskPickRow[]): PomodoroTaskPickRow[] {
  return items.toSorted((a, b) => {
    const bt = Date.parse(b.updated_at);
    const at = Date.parse(a.updated_at);
    if (Number.isFinite(bt) && Number.isFinite(at) && bt !== at) return bt - at;
    return b.id - a.id;
  });
}

export async function fetchRecentPendingTasksForPicker(): Promise<PomodoroTaskPickRow[]> {
  const data = await hub().call("task.list", withSubjectKind({ status: "pending", limit: 50 }));
  const items = (data.items ?? []) as PomodoroTaskPickRow[];
  return sortByUpdatedDesc(items).slice(0, PICK_LIMIT);
}

export async function searchPendingTasksForPicker(query: string): Promise<PomodoroTaskPickRow[]> {
  const q = query.trim();
  if (!q) return fetchRecentPendingTasksForPicker();
  const data = await hub().call(
    "task.search",
    withSubjectKind({ query: q, status: "pending", limit: PICK_LIMIT }),
  );
  return (data.items ?? []) as PomodoroTaskPickRow[];
}

export async function resolveTaskTitleForPicker(taskId: number): Promise<string | null> {
  const recent = await fetchRecentPendingTasksForPicker();
  const hit = recent.find((row) => row.id === taskId);
  if (hit) return hit.title;

  const data = await hub().call("task.list", withSubjectKind({ status: "all", limit: 200 }));
  const items = (data.items ?? []) as PomodoroTaskPickRow[];
  return items.find((row) => row.id === taskId)?.title ?? null;
}
