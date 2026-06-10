import { setMagnet } from "@freeanima/capabilities-fridge-magnet";
import type { TaskPriority, TaskStorePort } from "@freeanima/engine-repos";
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
  };
}

function formatSummaryLine(title: string, priority: TaskPriority): string {
  const emoji = PRIORITY_EMOJI[priority];
  return emoji ? `${emoji} ${title}` : title;
}

/** Write pending + in_progress todo summary to fridge:tasks:summary */
export async function syncTasksSummary(store: TaskStorePort, bridge?: FridgeBridge): Promise<void> {
  if (!bridge) return;
  try {
    const rows = await store.list({ limit: SUMMARY_LIST_LIMIT });
    const count = rows.length;
    if (count === 0) {
      await bridge.setMagnet("tasks", "summary", "Todos (0)", SUMMARY_TTL);
      return;
    }
    const preview = rows
      .slice(0, SUMMARY_PREVIEW)
      .map((row) => formatSummaryLine(row.title, row.priority));
    const content = `Todos (${count}) | ${preview.join(" | ")}`;
    await bridge.setMagnet("tasks", "summary", content, SUMMARY_TTL);
  } catch {
    /* Summary sync failure does not affect main flow */
  }
}
