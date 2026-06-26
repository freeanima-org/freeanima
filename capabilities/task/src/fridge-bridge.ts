import type { TaskItemPriority } from "@freeanima/core/db/schema/entity";

import type { TaskItemRow } from "./types.ts";

export type FridgeBridge = {
  setMagnet(module: string, id: string, value: string, ttl?: number): Promise<void>;
  deleteMagnet(module: string, id: string): Promise<void>;
};

const SUMMARY_PREVIEW = 5;
const SUMMARY_TTL = 86400;

const PRIORITY_EMOJI: Record<TaskItemPriority, string> = {
  high: "🔴",
  medium: "🟡",
  low: "⚪",
  none: "",
};

function formatSummaryLine(title: string, priority: TaskItemPriority): string {
  const emoji = PRIORITY_EMOJI[priority];
  return emoji ? `${emoji} ${title}` : title;
}

/** 待办摘要：到期标题 + 无截止日期数量 */
export function buildEntityTasksSummaryContent(rows: TaskItemRow[], nowArg?: Date): string | null {
  const now = nowArg ?? new Date();
  const pending = rows.filter((r) => r.status === "pending");
  const dueRows = pending
    .filter((r) => r.due_at != null && new Date(r.due_at) <= now)
    .toSorted((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    .slice(0, SUMMARY_PREVIEW);
  const undatedCount = pending.filter((r) => r.due_at == null).length;

  const parts = [
    ...dueRows.map((r) => formatSummaryLine(r.title, r.priority)),
    ...(undatedCount > 0 ? [`${undatedCount} 个待办`] : []),
  ];
  return parts.length > 0 ? parts.join(" | ") : null;
}

export async function syncEntityTasksSummary(
  rows: TaskItemRow[],
  bridge?: FridgeBridge,
): Promise<void> {
  if (!bridge) return;
  try {
    const content = buildEntityTasksSummaryContent(rows);
    if (content === null) {
      await bridge.deleteMagnet("tasks", "summary");
      return;
    }
    await bridge.setMagnet("tasks", "summary", content, SUMMARY_TTL);
  } catch {
    /* 摘要同步失败不影响主流程 */
  }
}
