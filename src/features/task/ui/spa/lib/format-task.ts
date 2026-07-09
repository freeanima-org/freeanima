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

/** `<input type="date">` 需本地年月日，不能用 toISOString().slice(0,10)（那是 UTC） */
export function isoToDateLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `<input type="time">` 需本地时分 */
export function isoToTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 合并 `<input type="date">` + `<input type="time">` 为 ISO 字符串；date 为空则返回 null */
export function mergeDateTimeLocal(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
