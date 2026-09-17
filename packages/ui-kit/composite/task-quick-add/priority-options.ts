import type { TaskItemPriority } from "../../lib/task-item-display.ts";

export type PriorityMenuEntry = {
  value: TaskItemPriority;
  label: string;
  aliases: string[];
};

export const PRIORITY_MENU_ENTRIES: PriorityMenuEntry[] = [
  { value: "high", label: "高", aliases: ["高", "gao", "h", "high", "p1", "1", "!!!"] },
  { value: "medium", label: "中", aliases: ["中", "zhong", "m", "medium", "p2", "2", "!!"] },
  { value: "low", label: "低", aliases: ["低", "di", "l", "low", "p3", "3", "!"] },
  { value: "none", label: "无", aliases: ["无", "wu", "n", "none", "p4", "4"] },
];

export function matchPriorityEntries(query: string): PriorityMenuEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return PRIORITY_MENU_ENTRIES;
  return PRIORITY_MENU_ENTRIES.filter((entry) =>
    entry.aliases.some((alias) => alias.startsWith(q) || alias.includes(q)),
  );
}

export function priorityChipLabel(priority: TaskItemPriority): string {
  const row = PRIORITY_MENU_ENTRIES.find((e) => e.value === priority);
  return row?.label ?? "无";
}
