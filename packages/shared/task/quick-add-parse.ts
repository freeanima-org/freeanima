import { formatCstIso } from "@freeanima/shared/util/time.ts";

/** 从标题启发式解析计划开始日期；不处理 @/#/!/ 前缀元信息 */
export type QuickAddTitleParseResult = {
  title: string;
  start_at: string | null;
};

const DEFAULT_PLAN_TIME = "09:00";

const RELATIVE_DAY: Array<{ pattern: RegExp; addDays: number }> = [
  { pattern: /今天/g, addDays: 0 },
  { pattern: /今日/g, addDays: 0 },
  { pattern: /明[日天]/g, addDays: 1 },
  { pattern: /后天/g, addDays: 2 },
  { pattern: /大后天/g, addDays: 3 },
];

const WEEKDAY_CHARS = "一二三四五六日天";
const WEEKDAY_PATTERN = new RegExp(`(下)?(?:周|星期)?([${WEEKDAY_CHARS}])`, "g");

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function mergeDateTimeLocal(datePart: string, timePart: string): string | null {
  const d = new Date(`${datePart}T${timePart}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return formatCstIso(d);
}

function startOfLocalDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function weekdayCharToIndex(ch: string): number {
  const map: Record<string, number> = {
    日: 0,
    天: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
  };
  return map[ch] ?? -1;
}

function resolveWeekdayDate(now: Date, nextWeek: boolean, weekday: number): Date {
  const base = startOfLocalDay(now);
  const current = base.getDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0 && nextWeek) delta = 7;
  else if (nextWeek) delta += 7;
  return addDays(base, delta);
}

type MatchSpan = { start: number; end: number; date: Date };

function findAbsoluteDate(text: string, now: Date): MatchSpan | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) {
      return { start: iso.index, end: iso.index + iso[0].length, date: startOfLocalDay(d) };
    }
  }

  const cn = /(\d{1,2})月(\d{1,2})日/.exec(text);
  if (cn) {
    const month = Number(cn[1]);
    const day = Number(cn[2]);
    let year = now.getFullYear();
    const candidate = new Date(year, month - 1, day);
    if (candidate < startOfLocalDay(now) && month < now.getMonth() + 1) {
      year += 1;
    }
    const d = new Date(year, month - 1, day);
    if (!Number.isNaN(d.getTime())) {
      return { start: cn.index, end: cn.index + cn[0].length, date: startOfLocalDay(d) };
    }
  }

  const slash = /(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\s|$)/.exec(text);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = now.getFullYear();
    const d = new Date(year, month - 1, day);
    if (!Number.isNaN(d.getTime())) {
      const start = slash.index + (slash[0].startsWith(" ") ? 1 : 0);
      return { start, end: start + slash[0].trim().length, date: startOfLocalDay(d) };
    }
  }

  return null;
}

function findRelativeOrWeekday(text: string, now: Date): MatchSpan | null {
  for (const { pattern, addDays: offset } of RELATIVE_DAY) {
    pattern.lastIndex = 0;
    const m = pattern.exec(text);
    if (m) {
      return {
        start: m.index,
        end: m.index + m[0].length,
        date: addDays(startOfLocalDay(now), offset),
      };
    }
  }

  WEEKDAY_PATTERN.lastIndex = 0;
  const wm = WEEKDAY_PATTERN.exec(text);
  if (wm) {
    const nextWeek = wm[1] === "下";
    const wd = weekdayCharToIndex(wm[2] ?? "");
    if (wd >= 0) {
      return {
        start: wm.index,
        end: wm.index + wm[0].length,
        date: resolveWeekdayDate(now, nextWeek, wd),
      };
    }
  }

  return null;
}

function stripSpan(text: string, span: MatchSpan): string {
  return `${text.slice(0, span.start)}${text.slice(span.end)}`.replace(/\s+/g, " ").trim();
}

/** 解析标题中的计划日期并返回净标题 */
export function parseQuickAddTitle(raw: string, now: Date = new Date()): QuickAddTitleParseResult {
  const text = raw.trim();
  if (!text) return { title: "", start_at: null };

  const absolute = findAbsoluteDate(text, now);
  if (absolute) {
    return {
      title: stripSpan(text, absolute),
      start_at: mergeDateTimeLocal(toDateLocal(absolute.date), DEFAULT_PLAN_TIME),
    };
  }

  const relative = findRelativeOrWeekday(text, now);
  if (relative) {
    return {
      title: stripSpan(text, relative),
      start_at: mergeDateTimeLocal(toDateLocal(relative.date), DEFAULT_PLAN_TIME),
    };
  }

  return { title: text, start_at: null };
}
