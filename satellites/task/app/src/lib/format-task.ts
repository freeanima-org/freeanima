import type { TaskItemRow } from "./api.ts";

export function priorityDot(priority: TaskItemRow["priority"]): string {
  switch (priority) {
    case "high":
      return "text-error";
    case "medium":
      return "text-warning";
    case "low":
      return "text-info";
    default:
      return "text-base-content/30";
  }
}

export function formatDue(due: string | null): string {
  if (!due) return "";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `<input type="datetime-local">` 需本地年月日时分，不能用 toISOString().slice(0,16)（那是 UTC） */
export function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
