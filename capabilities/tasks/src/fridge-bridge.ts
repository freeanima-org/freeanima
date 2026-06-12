import { deleteMagnet, setMagnet } from "@freeanima/capabilities-fridge-magnet";
import type { TaskPriority, TaskRow, TaskStorePort } from "@freeanima/engine-repos";
import type { FridgeBridge } from "./types.ts";

const SUMMARY_PREVIEW = 5;
const SUMMARY_LIST_LIMIT = 500;
const SUMMARY_TTL = 86400;

const PRIORITY_EMOJI: Record<TaskPriority, string> = {
  high: "🔴",
  medium: "🟡",
  low: "⚪",
  none: "",
};

export function createFridgeBridge(): FridgeBridge {
  return {
    setMagnet,
    deleteMagnet,
  };
}

function formatSummaryLine(title: string, priority: TaskPriority): string {
  const emoji = PRIORITY_EMOJI[priority];
  return emoji ? `${emoji} ${title}` : title;
}

/** Build fridge summary: due titles + undated count; null when nothing to show */
export function buildTasksSummaryContent(rows: TaskRow[], nowArg?: Date): string | null {
  const now = nowArg ?? new Date();
  const dueRows = rows
    .filter((r) => r.due_at != null && new Date(r.due_at) <= now)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    .slice(0, SUMMARY_PREVIEW);
  const undatedCount = rows.filter((r) => r.due_at == null).length;

  const parts = [
    ...dueRows.map((r) => formatSummaryLine(r.title, r.priority)),
    ...(undatedCount > 0 ? [`${undatedCount} 个待办`] : []),
  ];
  return parts.length > 0 ? parts.join(" | ") : null;
}

/** Write pending + in_progress todo summary to fridge-magnet:tasks:summary */
export async function syncTasksSummary(store: TaskStorePort, bridge?: FridgeBridge): Promise<void> {
  if (!bridge) return;
  try {
    const rows = await store.list({ limit: SUMMARY_LIST_LIMIT });
    const content = buildTasksSummaryContent(rows);
    if (content === null) {
      await bridge.deleteMagnet("tasks", "summary");
      return;
    }
    await bridge.setMagnet("tasks", "summary", content, SUMMARY_TTL);
  } catch {
    /* Summary sync failure does not affect main flow */
  }
}
