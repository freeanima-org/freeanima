import {
  addDaysToDateLocal,
  addMonthsToDateLocal,
  mergeDateTimeLocal,
  todayDateLocalValue,
} from "../../lib/datetime-local.ts";

export type DateSlashPresetId = "today" | "tomorrow" | "next_week" | "next_month";

export type DateSlashPreset = {
  id: DateSlashPresetId;
  label: string;
  /** 英文 slash 别名（不含 /） */
  aliasesEn: string[];
  /** 中文 slash 别名（不含 /） */
  aliasesZh: string[];
};

const DEFAULT_TIME = "09:00";

export const DATE_SLASH_PRESETS: DateSlashPreset[] = [
  {
    id: "today",
    label: "今天",
    aliasesEn: ["today"],
    aliasesZh: ["今天", "今日"],
  },
  {
    id: "tomorrow",
    label: "明天",
    aliasesEn: ["tomorrow", "tom"],
    aliasesZh: ["明天", "明日"],
  },
  {
    id: "next_week",
    label: "下周",
    aliasesEn: ["next week", "nextweek"],
    aliasesZh: ["下周"],
  },
  {
    id: "next_month",
    label: "下个月",
    aliasesEn: ["next month", "nextmonth"],
    aliasesZh: ["下个月", "下月"],
  },
];

function presetDateLocal(id: DateSlashPresetId, today: string): string {
  switch (id) {
    case "today":
      return today;
    case "tomorrow":
      return addDaysToDateLocal(today, 1);
    case "next_week":
      return addDaysToDateLocal(today, 7);
    case "next_month":
      return addMonthsToDateLocal(today, 1);
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function dateSlashPresetToStartAt(
  id: DateSlashPresetId,
  now: Date = new Date(),
): string | null {
  const today = todayDateLocalValue();
  void now;
  const datePart = presetDateLocal(id, today);
  return mergeDateTimeLocal(datePart, DEFAULT_TIME);
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function aliasMatches(alias: string, q: string): boolean {
  const a = alias.toLowerCase();
  return q.length === 0 || a.startsWith(q) || a.includes(q);
}

export function matchDateSlashPresets(query: string): DateSlashPreset[] {
  const q = normalizeQuery(query);
  if (q.length === 0) return [...DATE_SLASH_PRESETS];
  return DATE_SLASH_PRESETS.filter((preset) => {
    const all = [...preset.aliasesEn, ...preset.aliasesZh, preset.label];
    return all.some((alias) => aliasMatches(alias, q));
  });
}

/** 浮层主列左侧展示的 slash 命令 */
export function dateSlashPresetCommand(preset: DateSlashPreset): string {
  const en = preset.aliasesEn[0] ?? preset.id;
  return en.includes(" ") ? `/${en}` : `/${en}`;
}

export function formatPlanDateChipLabel(startAt: string): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return "计划";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
