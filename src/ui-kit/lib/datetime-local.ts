function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoToDateLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoToTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function mergeDateTimeLocal(datePart: string, timePart: string): string | null {
  if (!datePart) return null;
  const time = timePart || "00:00";
  const d = new Date(`${datePart}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function dateLocalToIso(datePart: string): string | null {
  return mergeDateTimeLocal(datePart, "00:00");
}

export function todayDateLocalValue(): string {
  return isoToDateLocalValue(new Date().toISOString());
}

export function formatDue(due: string | null): string {
  if (!due) return "";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** UI 列表/详情通用日期时间展示（Intl；空值显示 em dash） */
export function formatDateTime(value: string | null | undefined, emptyLabel = "—"): string {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

/** 详情顶栏截止 chip：如「7月13日」或「7月13日, 延期4天」 */
export function formatDueChip(due: string | null | undefined): {
  label: string;
  overdue: boolean;
} {
  if (!due) return { label: "截止日期", overdue: false };
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return { label: "截止日期", overdue: false };

  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((startToday.getTime() - startDue.getTime()) / 86_400_000);
  if (diffDays > 0) {
    return { label: `${dateLabel}, 延期${diffDays}天`, overdue: true };
  }
  return { label: dateLabel, overdue: false };
}
