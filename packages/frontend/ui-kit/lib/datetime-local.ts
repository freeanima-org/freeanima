import { formatCstIso } from "@freeanima/shared/util/time.ts";

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

/** 合并本地日期+时间为 host 时区 ISO（禁止裸 toISOString/Z） */
export function mergeDateTimeLocal(datePart: string, timePart: string): string | null {
  if (!datePart) return null;
  const time = timePart || "00:00";
  const d = new Date(`${datePart}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return formatCstIso(d);
}

export function dateLocalToIso(datePart: string): string | null {
  return mergeDateTimeLocal(datePart, "00:00");
}

export function todayDateLocalValue(): string {
  return isoToDateLocalValue(formatCstIso(new Date()));
}

const DATE_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 解析 YYYY-MM-DD 为本地日历日（无效返回 null） */
export function parseDateLocalValue(datePart: string): Date | null {
  const match = DATE_LOCAL_RE.exec(datePart.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function toDateLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 在 YYYY-MM-DD 上加减天数（基准缺省为今天） */
export function addDaysToDateLocal(datePart: string | null | undefined, days: number): string {
  const base = datePart ? parseDateLocalValue(datePart) : new Date();
  const d = base ?? new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toDateLocalValue(d);
}

/**
 * 在 YYYY-MM-DD 上加减整月；日溢出取该月末（如 1/31 +1月 → 2/28|29）。
 * 基准缺省为今天。
 */
export function addMonthsToDateLocal(datePart: string | null | undefined, months: number): string {
  const base = datePart ? parseDateLocalValue(datePart) : new Date();
  const d = base ?? new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateLocalValue(d);
}

export type DateLocalPresetId = "today" | "tomorrow" | "next_week" | "next_month";

export type DateLocalPreset = {
  id: DateLocalPresetId;
  label: string;
  value: string;
};

/** 日期选择快捷：今天 / 明天 / 下周(+7) / 下个月(同日进月) */
export function dateLocalPresets(): DateLocalPreset[] {
  const today = todayDateLocalValue();
  return [
    { id: "today", label: "今天", value: today },
    { id: "tomorrow", label: "明天", value: addDaysToDateLocal(today, 1) },
    { id: "next_week", label: "下周", value: addDaysToDateLocal(today, 7) },
    { id: "next_month", label: "下个月", value: addMonthsToDateLocal(today, 1) },
  ];
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

/** 详情顶栏提醒 chip */
export function formatRemindChip(remind: string | null | undefined): string {
  if (!remind) return "提醒";
  const d = new Date(remind);
  if (Number.isNaN(d.getTime())) return "提醒";
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`;
  const time = isoToTimeLocalValue(remind);
  return time ? `${dateLabel} ${time}` : dateLabel;
}
