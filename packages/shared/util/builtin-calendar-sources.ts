/**
 * 内置日历源：按公历年展开只读命名日（非连休/调休）。
 * Habitat 可按年 Redis 缓存；前端 prefs 按 source 独立开关。
 */
import {
  getDayDetail,
  getLunarFestivals,
  getSolarDateFromLunar,
  getSolarTerms,
} from "chinese-days";

export const BUILTIN_CALENDAR_SOURCE_IDS = [
  "cn_holiday",
  "traditional",
  "international",
  "solar_term",
] as const;

export type BuiltinCalendarSourceId = (typeof BUILTIN_CALENDAR_SOURCE_IDS)[number];

export type BuiltinCalendarItem = {
  id: string;
  source: BuiltinCalendarSourceId;
  title: string;
  date: string;
};

export type BuiltinCalendarSourceMeta = {
  id: BuiltinCalendarSourceId;
  title: string;
};

export const BUILTIN_CALENDAR_SOURCE_META: readonly BuiltinCalendarSourceMeta[] = [
  { id: "cn_holiday", title: "中国节假日" },
  { id: "traditional", title: "传统节日" },
  { id: "international", title: "国际节日" },
  { id: "solar_term", title: "二十四节气" },
] as const;

export function listBuiltinCalendarSources(): readonly BuiltinCalendarSourceMeta[] {
  return BUILTIN_CALENDAR_SOURCE_META;
}

export function isBuiltinCalendarSourceId(v: unknown): v is BuiltinCalendarSourceId {
  return typeof v === "string" && (BUILTIN_CALENDAR_SOURCE_IDS as readonly string[]).includes(v);
}

/** 中国法定命名日（getDayDetail 中文段 → 展示名） */
const CN_HOLIDAY_TITLE_BY_KEY: Readonly<Record<string, string>> = {
  元旦: "元旦",
  春节: "春节",
  清明: "清明",
  劳动节: "劳动节",
  端午: "端午节",
  中秋: "中秋节",
  国庆节: "国庆节",
};

/** 传统节日：匹配 getLunarFestivals 名称 → 展示名 */
const TRADITIONAL_TITLE_BY_MATCH: ReadonlyArray<{ match: string; title: string; slug: string }> = [
  { match: "元宵节", title: "元宵节", slug: "yuanxiao" },
  { match: "乞巧节", title: "七夕", slug: "qixi" },
  { match: "重阳节", title: "重阳节", slug: "chongyang" },
  { match: "腊八节", title: "腊八节", slug: "laba" },
  { match: "除夕", title: "除夕", slug: "chuxi" },
];

/** 国际节日：公历固定 MM-DD */
const INTERNATIONAL_FIXED: ReadonlyArray<{ mmdd: string; title: string; slug: string }> = [
  { mmdd: "02-14", title: "情人节", slug: "valentine" },
  { mmdd: "03-08", title: "妇女节", slug: "womens-day" },
  { mmdd: "04-01", title: "愚人节", slug: "april-fools" },
  { mmdd: "10-31", title: "万圣节", slug: "halloween" },
  { mmdd: "12-24", title: "平安夜", slug: "christmas-eve" },
  { mmdd: "12-25", title: "圣诞节", slug: "christmas" },
];

const CN_HOLIDAY_SLUG: Readonly<Record<string, string>> = {
  元旦: "yuandan",
  春节: "chunjie",
  清明: "qingming",
  劳动节: "laodong",
  端午节: "duanwu",
  中秋节: "zhongqiu",
  国庆节: "guoqing",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function itemId(source: BuiltinCalendarSourceId, slug: string, date: string): string {
  return `holiday:${source}:${slug}:${date}`;
}

function parseCnHolidayKey(detailName: string): string | null {
  // "National Day,国庆节,3" / "Dragon Boat Festival,端午,1"
  const parts = detailName.split(",");
  if (parts.length < 2) return null;
  const key = parts[1]?.trim();
  if (!key) return null;
  return key in CN_HOLIDAY_TITLE_BY_KEY ? key : null;
}

function eachDayOfYear(year: number, fn: (date: string) => void): void {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    fn(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
  }
}

/** 中国节假日命名日：每年每种节日只取首个法定假日名出现日（不含连休后续日、不含调休上班） */
export function expandCnHolidayYear(year: number): BuiltinCalendarItem[] {
  const seen = new Set<string>();
  const out: BuiltinCalendarItem[] = [];

  // 春节代表日优先用农历正月初一（与法定连休首日通常一致）
  try {
    const spring = getSolarDateFromLunar(`${year}-01-01`);
    const springDate = spring?.date;
    const springTitle = CN_HOLIDAY_TITLE_BY_KEY["春节"];
    const springSlug = springTitle != null ? CN_HOLIDAY_SLUG[springTitle] : undefined;
    if (springDate?.startsWith(`${year}-`) && springTitle != null && springSlug != null) {
      seen.add("春节");
      out.push({
        id: itemId("cn_holiday", springSlug, springDate),
        source: "cn_holiday",
        title: springTitle,
        date: springDate,
      });
    }
  } catch {
    /* 库年份不足时回退扫描 */
  }

  eachDayOfYear(year, (date) => {
    const detail = getDayDetail(date);
    if (detail.work) return;
    const key = parseCnHolidayKey(detail.name);
    if (!key || seen.has(key)) return;
    const title = CN_HOLIDAY_TITLE_BY_KEY[key];
    const slug = title != null ? CN_HOLIDAY_SLUG[title] : undefined;
    if (title == null || slug == null) return;
    seen.add(key);
    out.push({
      id: itemId("cn_holiday", slug, date),
      source: "cn_holiday",
      title,
      date,
    });
  });

  return out.toSorted((a, b) => a.date.localeCompare(b.date));
}

export function expandTraditionalYear(year: number): BuiltinCalendarItem[] {
  const { start, end } = yearBounds(year);
  const festivals = getLunarFestivals(start, end);
  const out: BuiltinCalendarItem[] = [];
  const seenSlug = new Set<string>();

  for (const row of festivals) {
    if (!row.date.startsWith(`${year}-`)) continue;
    for (const raw of row.name) {
      for (const def of TRADITIONAL_TITLE_BY_MATCH) {
        if (!raw.includes(def.match) && raw !== def.match) continue;
        if (seenSlug.has(def.slug)) continue;
        seenSlug.add(def.slug);
        out.push({
          id: itemId("traditional", def.slug, row.date),
          source: "traditional",
          title: def.title,
          date: row.date,
        });
      }
    }
  }

  return out.toSorted((a, b) => a.date.localeCompare(b.date));
}

export function expandInternationalYear(year: number): BuiltinCalendarItem[] {
  return INTERNATIONAL_FIXED.map((def) => {
    const date = `${year}-${def.mmdd}`;
    return {
      id: itemId("international", def.slug, date),
      source: "international" as const,
      title: def.title,
      date,
    };
  });
}

export function expandSolarTermYear(year: number): BuiltinCalendarItem[] {
  const { start, end } = yearBounds(year);
  const terms = getSolarTerms(start, end);
  const out: BuiltinCalendarItem[] = [];
  for (const term of terms) {
    if (!term.date.startsWith(`${year}-`)) continue;
    out.push({
      id: itemId("solar_term", term.term, term.date),
      source: "solar_term",
      title: term.name,
      date: term.date,
    });
  }
  return out.toSorted((a, b) => a.date.localeCompare(b.date));
}

export function expandBuiltinSourceYear(
  source: BuiltinCalendarSourceId,
  year: number,
): BuiltinCalendarItem[] {
  switch (source) {
    case "cn_holiday":
      return expandCnHolidayYear(year);
    case "traditional":
      return expandTraditionalYear(year);
    case "international":
      return expandInternationalYear(year);
    case "solar_term":
      return expandSolarTermYear(year);
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

/** 裁剪到闭区间 [fromDate, toDate]（YYYY-MM-DD） */
export function filterBuiltinItemsByDateRange(
  items: readonly BuiltinCalendarItem[],
  fromDate: string,
  toDate: string,
): BuiltinCalendarItem[] {
  return items.filter((it) => it.date >= fromDate && it.date <= toDate);
}

/** 同日同标题跨源去重（保留先出现的 source 顺序） */
export function dedupeBuiltinItemsByDateTitle(
  items: readonly BuiltinCalendarItem[],
): BuiltinCalendarItem[] {
  const seen = new Set<string>();
  const out: BuiltinCalendarItem[] = [];
  for (const it of items) {
    const key = `${it.date}\0${it.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function yearsOverlappingRange(fromIso: string, toIso: string): number[] {
  const fromY = Number(fromIso.slice(0, 4));
  const toY = Number(toIso.slice(0, 4));
  if (!Number.isFinite(fromY) || !Number.isFinite(toY)) return [];
  const start = Math.min(fromY, toY);
  const end = Math.max(fromY, toY);
  const years: number[] = [];
  for (let y = start; y <= end; y += 1) years.push(y);
  return years;
}
