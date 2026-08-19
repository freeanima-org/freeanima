/** 日程本机 UI 偏好（localStorage，不同步 Habitat；窄/宽布局共用） */

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

export type CalendarUiPrefs = {
  expandRecurrence: boolean;
  viewMode: CalendarViewMode;
  kinds: CalendarKindPref[];
};

const ALL_KINDS: CalendarKindPref[] = ["event", "task", "project"];

const DEFAULT_PREFS: CalendarUiPrefs = {
  expandRecurrence: true,
  viewMode: "month",
  kinds: [...ALL_KINDS],
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
  return isViewMode(v) ? v : DEFAULT_PREFS.viewMode;
}

function isKind(v: unknown): v is CalendarKindPref {
  return v === "event" || v === "task" || v === "project";
}

function normalizeKinds(raw: unknown): CalendarKindPref[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PREFS.kinds];
  const next = raw.filter(isKind);
  return next.length > 0 ? [...new Set(next)] : [...DEFAULT_PREFS.kinds];
}

function parsePrefs(raw: string | null): CalendarUiPrefs | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    return {
      expandRecurrence:
        typeof obj.expandRecurrence === "boolean"
          ? obj.expandRecurrence
          : DEFAULT_PREFS.expandRecurrence,
      viewMode: normalizeViewMode(obj.viewMode),
      kinds: normalizeKinds(obj.kinds),
    };
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

export function readCalendarUiPrefs(): CalendarUiPrefs {
  try {
    const store = storage();
    if (store) {
      const fromJson = parsePrefs(store.getItem(CALENDAR_UI_PREFS_KEY));
      if (fromJson) return fromJson;
      const legacyExpand = migrateLegacyExpandRecurrence(store);
      if (legacyExpand != null) {
        const migrated = { ...DEFAULT_PREFS, expandRecurrence: legacyExpand };
        store.setItem(CALENDAR_UI_PREFS_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    if (memoryFallback != null) return { ...memoryFallback, kinds: [...memoryFallback.kinds] };
    return { ...DEFAULT_PREFS, kinds: [...DEFAULT_PREFS.kinds] };
  } catch {
    if (memoryFallback != null) return { ...memoryFallback, kinds: [...memoryFallback.kinds] };
    return { ...DEFAULT_PREFS, kinds: [...DEFAULT_PREFS.kinds] };
  }
}

export function writeCalendarUiPrefs(patch: Partial<CalendarUiPrefs>): CalendarUiPrefs {
  const current = readCalendarUiPrefs();
  const next: CalendarUiPrefs = {
    expandRecurrence: patch.expandRecurrence ?? current.expandRecurrence,
    viewMode: patch.viewMode ?? current.viewMode,
    kinds: patch.kinds != null ? normalizeKinds(patch.kinds) : current.kinds,
  };
  memoryFallback = next;
  try {
    storage()?.setItem(CALENDAR_UI_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  notify();
  return next;
}

export function readExpandRecurrence(): boolean {
  return readCalendarUiPrefs().expandRecurrence;
}

export function writeExpandRecurrence(enabled: boolean): void {
  writeCalendarUiPrefs({ expandRecurrence: enabled });
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
