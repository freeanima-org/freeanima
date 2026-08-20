import type { CalendarRangeItem, CalendarRangeKind } from "./api.ts";
import { dayKeyFromIso, nextDayKey } from "./format-calendar.ts";

export type DayRange = { start: string; end: string };

export type PackedBar = {
  item: CalendarRangeItem;
  /** 0-based 列起点（周一=0） */
  colStart: number;
  colSpan: number;
  lane: number;
};

/** 月/周视图每行最多展示的事件条 lane 数 */
export const MAX_VISIBLE_BAR_LANES = 3;

/** 统一 event / task / project / holiday 的日历日闭区间 */
export function itemDayRange(item: CalendarRangeItem): DayRange | null {
  if (item.kind === "event" || item.kind === "holiday") {
    const start = dayKeyFromIso(item.start_at);
    if (!start) return null;
    const end = dayKeyFromIso(item.end_at ?? item.start_at) || start;
    return end < start ? { start, end: start } : { start, end };
  }
  if (item.kind === "task") {
    // 日历条带用计划区间；due 不当地平终点。无计划则不展示条带。
    if (!item.start_at) return null;
    const start = dayKeyFromIso(item.start_at);
    if (!start) return null;
    const end = (item.end_at ? dayKeyFromIso(item.end_at) : start) || start;
    return end < start ? { start: end, end: start } : { start, end };
  }
  const start = dayKeyFromIso(item.start_at ?? "");
  if (!start) return null;
  const end = dayKeyFromIso(item.end_at ?? item.start_at ?? "") || start;
  return end < start ? { start, end: start } : { start, end };
}

/** 将日区间与周行日列求交，返回 0-based 列 span；无交集则 null */
export function clipRangeToDays(
  range: DayRange,
  weekDays: readonly (string | null)[],
): { colStart: number; colSpan: number } | null {
  let first = -1;
  let last = -1;
  for (let i = 0; i < weekDays.length; i += 1) {
    const day = weekDays[i];
    if (!day) continue;
    if (day < range.start || day > range.end) continue;
    if (first < 0) first = i;
    last = i;
  }
  if (first < 0 || last < 0) return null;
  return { colStart: first, colSpan: last - first + 1 };
}

function rangesOverlap(aStart: number, aSpan: number, bStart: number, bSpan: number): boolean {
  const aEnd = aStart + aSpan;
  const bEnd = bStart + bSpan;
  return aStart < bEnd && bStart < aEnd;
}

/**
 * 将条目打包到一周 7 列内：跨日贯穿、重叠错开 lane。
 * `weekDays` 长度应为 7；月视图 padding 格为 null。
 */
export function packBarsForWeek(
  items: readonly CalendarRangeItem[],
  weekDays: readonly (string | null)[],
): PackedBar[] {
  const candidates: Omit<PackedBar, "lane">[] = [];
  for (const item of items) {
    const range = itemDayRange(item);
    if (range) {
      const clip = clipRangeToDays(range, weekDays);
      if (clip) candidates.push({ item, colStart: clip.colStart, colSpan: clip.colSpan });
    }
    if (item.kind === "task" && item.status === "completed" && item.completed_at) {
      const doneDay = dayKeyFromIso(item.completed_at);
      if (doneDay && (!range || doneDay < range.start || doneDay > range.end)) {
        const clip = clipRangeToDays({ start: doneDay, end: doneDay }, weekDays);
        if (clip) candidates.push({ item, colStart: clip.colStart, colSpan: clip.colSpan });
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.colStart !== b.colStart) return a.colStart - b.colStart;
    if (b.colSpan !== a.colSpan) return b.colSpan - a.colSpan;
    return String(a.item.id).localeCompare(String(b.item.id), "en");
  });

  const packed: PackedBar[] = [];
  for (const c of candidates) {
    let lane = 0;
    for (;;) {
      const conflict = packed.some(
        (p) => p.lane === lane && rangesOverlap(p.colStart, p.colSpan, c.colStart, c.colSpan),
      );
      if (!conflict) break;
      lane += 1;
    }
    packed.push({ ...c, lane });
  }
  return packed;
}

/** 与 AgendaList kind 徽章对齐的事件条底色 */
export function kindBarClass(
  kind: CalendarRangeKind,
  opts?: { virtual?: boolean; completed?: boolean },
): string {
  if (opts?.virtual) {
    return "bg-muted/60 text-muted-foreground italic";
  }
  if (opts?.completed) {
    return "bg-muted/50 text-muted-foreground line-through";
  }
  if (kind === "event") return "bg-primary/20 text-primary";
  if (kind === "task") return "bg-amber-500/20 text-amber-800 dark:text-amber-200";
  if (kind === "holiday") return "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200";
  return "bg-sky-500/20 text-sky-800 dark:text-sky-200";
}

/** 逐日计数（跨日条目计入每一天） */
export function countByDay(items: readonly CalendarRangeItem[]): Map<string, number> {
  const map = new Map<string, number>();
  const bump = (day: string) => {
    if (!day) return;
    map.set(day, (map.get(day) ?? 0) + 1);
  };
  for (const item of items) {
    const range = itemDayRange(item);
    if (!range) continue;
    let cur: string | null = range.start;
    while (cur != null && cur <= range.end) {
      bump(cur);
      const next = nextDayKey(cur);
      if (next == null || next > range.end) break;
      cur = next;
    }
  }
  return map;
}

/** 某日因 lane 超出可见上限而隐藏的条目数 */
export function dayOverflowCount(
  packed: readonly PackedBar[],
  dayCol: number,
  maxLanes: number = MAX_VISIBLE_BAR_LANES,
): number {
  let hidden = 0;
  for (const bar of packed) {
    if (bar.lane < maxLanes) continue;
    if (dayCol >= bar.colStart && dayCol < bar.colStart + bar.colSpan) hidden += 1;
  }
  return hidden;
}

export function barItemKey(item: CalendarRangeItem): string {
  if (item.kind === "task") {
    const clock = item.end_at ?? item.start_at ?? item.due_at ?? "";
    return `task:${item.id}:${clock}:${item.virtual ? "v" : "l"}`;
  }
  return `${item.kind}:${item.id}`;
}
