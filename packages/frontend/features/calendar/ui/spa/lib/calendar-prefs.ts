/** 日程 UI 偏好：本地缓存优先；Habitat `calendar.prefs.*` 为权威副本 */

import {
  BUILTIN_CALENDAR_SOURCE_IDS,
  BUILTIN_CALENDAR_SOURCE_META,
  isBuiltinCalendarSourceId,
  type BuiltinCalendarSourceId,
} from "@freeanima/shared/util/builtin-calendar-sources.ts";
import { asRecord } from "@freeanima/shared/util";

export const CALENDAR_UI_PREFS_KEY = "freeanima.calendar.uiPrefs";

/** @deprecated 迁移用；读到后写入 CALENDAR_UI_PREFS_KEY 并删除 */
export const CALENDAR_EXPAND_RECURRENCE_KEY = "freeanima.calendar.expandRecurrence";

export type CalendarViewMode = "day" | "next3" | "next7" | "week" | "month";

export const CALENDAR_VIEW_MODES: readonly CalendarViewMode[] = [
  "day",
  "next3",
  "next7",
  "week",
  "month",
];

export const CALENDAR_VIEW_MODE_LABEL: Record<CalendarViewMode, string> = {
  day: "日",
  next3: "近三天",
  next7: "近七天",
  week: "周",
  month: "月",
};

export function isAgendaViewMode(mode: CalendarViewMode): boolean {
  return mode === "day" || mode === "next3" || mode === "next7";
}

export type CalendarKindPref = "event" | "task" | "project";

export type { BuiltinCalendarSourceId };

export const BUILTIN_SOURCE_OPTIONS = BUILTIN_CALENDAR_SOURCE_META;

export type CalendarViewDisplayPrefs = {
  kinds: CalendarKindPref[];
  builtinSources: BuiltinCalendarSourceId[];
  expandRecurrence: boolean;
  showCompleted: boolean;
  showEndedEvents: boolean;
};

export type CalendarUiPrefs = {
  viewMode: CalendarViewMode;
  byView: Record<CalendarViewMode, CalendarViewDisplayPrefs>;
};

const ALL_KINDS: CalendarKindPref[] = ["event", "task", "project"];

function defaultViewDisplay(mode: CalendarViewMode): CalendarViewDisplayPrefs {
  const agendaLike = mode === "day" || mode === "next3" || mode === "next7";
  return {
    kinds: [...ALL_KINDS],
    builtinSources: [...BUILTIN_CALENDAR_SOURCE_IDS],
    expandRecurrence: true,
    showCompleted: mode !== "month",
    showEndedEvents: !agendaLike,
  };
}

export const DEFAULT_CALENDAR_UI_PREFS: CalendarUiPrefs = {
  viewMode: "month",
  byView: {
    day: defaultViewDisplay("day"),
    next3: defaultViewDisplay("next3"),
    next7: defaultViewDisplay("next7"),
    week: defaultViewDisplay("week"),
    month: defaultViewDisplay("month"),
  },
};

type Listener = () => void;
const listeners = new Set<Listener>();

let memoryFallback: CalendarUiPrefs | null = null;

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function isViewMode(v: unknown): v is CalendarViewMode {
  return v === "day" || v === "next3" || v === "next7" || v === "week" || v === "month";
}

function normalizeViewMode(v: unknown): CalendarViewMode {
  if (v === "today") return "day";
  return isViewMode(v) ? v : DEFAULT_CALENDAR_UI_PREFS.viewMode;
}

function isKind(v: unknown): v is CalendarKindPref {
  return v === "event" || v === "task" || v === "project";
}

function normalizeKinds(raw: unknown): CalendarKindPref[] {
  if (!Array.isArray(raw)) return [...ALL_KINDS];
  const next = raw.filter(isKind);
  return next.length > 0 ? [...new Set(next)] : [...ALL_KINDS];
}

function normalizeBuiltinSources(raw: unknown): BuiltinCalendarSourceId[] {
  if (!Array.isArray(raw)) return [...BUILTIN_CALENDAR_SOURCE_IDS];
  return [...new Set(raw.filter(isBuiltinCalendarSourceId))];
}

function normalizeViewDisplay(raw: unknown, mode: CalendarViewMode): CalendarViewDisplayPrefs {
  const fallback = defaultViewDisplay(mode);
  if (raw == null || typeof raw !== "object") return fallback;
  const obj = asRecord(raw) ?? {};
  return {
    kinds: obj.kinds !== undefined ? normalizeKinds(obj.kinds) : fallback.kinds,
    builtinSources:
      obj.builtinSources !== undefined
        ? normalizeBuiltinSources(obj.builtinSources)
        : fallback.builtinSources,
    expandRecurrence:
      typeof obj.expandRecurrence === "boolean" ? obj.expandRecurrence : fallback.expandRecurrence,
    showCompleted:
      typeof obj.showCompleted === "boolean" ? obj.showCompleted : fallback.showCompleted,
    showEndedEvents:
      typeof obj.showEndedEvents === "boolean" ? obj.showEndedEvents : fallback.showEndedEvents,
  };
}

function clonePrefs(prefs: CalendarUiPrefs): CalendarUiPrefs {
  return {
    viewMode: prefs.viewMode,
    byView: {
      day: {
        ...prefs.byView.day,
        kinds: [...prefs.byView.day.kinds],
        builtinSources: [...prefs.byView.day.builtinSources],
      },
      next3: {
        ...prefs.byView.next3,
        kinds: [...prefs.byView.next3.kinds],
        builtinSources: [...prefs.byView.next3.builtinSources],
      },
      next7: {
        ...prefs.byView.next7,
        kinds: [...prefs.byView.next7.kinds],
        builtinSources: [...prefs.byView.next7.builtinSources],
      },
      week: {
        ...prefs.byView.week,
        kinds: [...prefs.byView.week.kinds],
        builtinSources: [...prefs.byView.week.builtinSources],
      },
      month: {
        ...prefs.byView.month,
        kinds: [...prefs.byView.month.kinds],
        builtinSources: [...prefs.byView.month.builtinSources],
      },
    },
  };
}

/** 旧扁平 prefs → byView */
function migrateFlatPrefs(obj: Record<string, unknown>): CalendarUiPrefs {
  const viewMode = normalizeViewMode(obj.viewMode);
  const shared: CalendarViewDisplayPrefs = {
    kinds: normalizeKinds(obj.kinds),
    builtinSources:
      obj.builtinSources === undefined
        ? [...BUILTIN_CALENDAR_SOURCE_IDS]
        : normalizeBuiltinSources(obj.builtinSources),
    expandRecurrence:
      typeof obj.expandRecurrence === "boolean"
        ? obj.expandRecurrence
        : DEFAULT_CALENDAR_UI_PREFS.byView.month.expandRecurrence,
    showCompleted: defaultViewDisplay(viewMode).showCompleted,
    showEndedEvents: defaultViewDisplay(viewMode).showEndedEvents,
  };
  const byView = { ...DEFAULT_CALENDAR_UI_PREFS.byView };
  for (const mode of CALENDAR_VIEW_MODES) {
    byView[mode] = {
      ...shared,
      kinds: [...shared.kinds],
      builtinSources: [...shared.builtinSources],
      showCompleted: defaultViewDisplay(mode).showCompleted,
      showEndedEvents: defaultViewDisplay(mode).showEndedEvents,
    };
  }
  return { viewMode, byView };
}

export function parseCalendarUiPrefs(raw: unknown): CalendarUiPrefs | null {
  if (raw == null || typeof raw !== "object") return null;
  const obj = asRecord(raw) ?? {};
  if (obj.byView != null && typeof obj.byView === "object") {
    const byRaw = asRecord(obj.byView) ?? {};
    return {
      viewMode: normalizeViewMode(obj.viewMode),
      byView: {
        day: normalizeViewDisplay(byRaw.day, "day"),
        next3: normalizeViewDisplay(byRaw.next3, "next3"),
        next7: normalizeViewDisplay(byRaw.next7, "next7"),
        week: normalizeViewDisplay(byRaw.week, "week"),
        month: normalizeViewDisplay(byRaw.month, "month"),
      },
    };
  }
  if ("kinds" in obj || "expandRecurrence" in obj || "viewMode" in obj) {
    return migrateFlatPrefs(obj);
  }
  return null;
}

function parsePrefs(raw: string | null): CalendarUiPrefs | null {
  if (raw == null || raw === "") return null;
  try {
    return parseCalendarUiPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

function migrateLegacyExpandRecurrence(store: Storage): boolean | null {
  const legacy = store.getItem(CALENDAR_EXPAND_RECURRENCE_KEY);
  if (legacy !== "0" && legacy !== "1") return null;
  store.removeItem(CALENDAR_EXPAND_RECURRENCE_KEY);
  return legacy === "1";
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function currentViewDisplay(prefs: CalendarUiPrefs): CalendarViewDisplayPrefs {
  return prefs.byView[prefs.viewMode];
}

export function readCalendarUiPrefs(): CalendarUiPrefs {
  try {
    const store = storage();
    if (store) {
      const fromJson = parsePrefs(store.getItem(CALENDAR_UI_PREFS_KEY));
      if (fromJson) return fromJson;
      const legacyExpand = migrateLegacyExpandRecurrence(store);
      if (legacyExpand != null) {
        const migrated = clonePrefs(DEFAULT_CALENDAR_UI_PREFS);
        for (const mode of CALENDAR_VIEW_MODES) {
          migrated.byView[mode].expandRecurrence = legacyExpand;
        }
        store.setItem(CALENDAR_UI_PREFS_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    if (memoryFallback != null) return clonePrefs(memoryFallback);
    return clonePrefs(DEFAULT_CALENDAR_UI_PREFS);
  } catch {
    if (memoryFallback != null) return clonePrefs(memoryFallback);
    return clonePrefs(DEFAULT_CALENDAR_UI_PREFS);
  }
}

export type CalendarUiPrefsWritePatch = {
  viewMode?: CalendarViewMode;
  byView?: Partial<Record<CalendarViewMode, Partial<CalendarViewDisplayPrefs>>>;
  /** 便捷：只改当前 viewMode 的显示偏好 */
  currentView?: Partial<CalendarViewDisplayPrefs>;
};

export function writeCalendarUiPrefs(patch: CalendarUiPrefsWritePatch): CalendarUiPrefs {
  const current = readCalendarUiPrefs();
  const viewMode = patch.viewMode ?? current.viewMode;
  const byView = clonePrefs(current).byView;

  if (patch.byView) {
    for (const mode of CALENDAR_VIEW_MODES) {
      const modePatch = patch.byView[mode];
      if (!modePatch) continue;
      byView[mode] = {
        ...byView[mode],
        ...modePatch,
        kinds: modePatch.kinds != null ? normalizeKinds(modePatch.kinds) : byView[mode].kinds,
        builtinSources:
          modePatch.builtinSources != null
            ? normalizeBuiltinSources(modePatch.builtinSources)
            : byView[mode].builtinSources,
      };
    }
  }

  if (patch.currentView) {
    const mode = viewMode;
    const modePatch = patch.currentView;
    byView[mode] = {
      ...byView[mode],
      ...modePatch,
      kinds: modePatch.kinds != null ? normalizeKinds(modePatch.kinds) : byView[mode].kinds,
      builtinSources:
        modePatch.builtinSources != null
          ? normalizeBuiltinSources(modePatch.builtinSources)
          : byView[mode].builtinSources,
    };
  }

  const next: CalendarUiPrefs = { viewMode, byView };
  memoryFallback = next;
  try {
    storage()?.setItem(CALENDAR_UI_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
  return next;
}

/** 用 Habitat 返回覆盖本地缓存（启动刷新） */
export function replaceCalendarUiPrefs(prefs: CalendarUiPrefs): CalendarUiPrefs {
  const next = clonePrefs(parseCalendarUiPrefs(prefs) ?? prefs);
  memoryFallback = next;
  try {
    storage()?.setItem(CALENDAR_UI_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
  return next;
}

export function readExpandRecurrence(): boolean {
  return currentViewDisplay(readCalendarUiPrefs()).expandRecurrence;
}

export function writeExpandRecurrence(enabled: boolean): void {
  writeCalendarUiPrefs({ currentView: { expandRecurrence: enabled } });
}

export function subscribeCalendarUiPrefs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetCalendarPrefsForTest(): void {
  memoryFallback = null;
  try {
    const store = storage();
    store?.removeItem(CALENDAR_UI_PREFS_KEY);
    store?.removeItem(CALENDAR_EXPAND_RECURRENCE_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export function builtinSourceLabel(id: BuiltinCalendarSourceId): string {
  return BUILTIN_CALENDAR_SOURCE_META.find((s) => s.id === id)?.title ?? id;
}
