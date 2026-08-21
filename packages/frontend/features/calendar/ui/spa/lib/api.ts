import type { NotificationRecipientKind } from "@freeanima/shared/rpc-contract/frames/notification";
import type {
  CalendarEventRowPayload,
  CalendarRangeItemPayload,
  CalendarRangeKind,
  BuiltinCalendarSourceIdPayload,
  CalendarUiPrefsPayload,
} from "@freeanima/shared/rpc-contract/frames/calendar";
import type {
  TaskItemRowPayload,
  TaskItemSearchFiltersPayload,
} from "@freeanima/shared/rpc-contract/frames/task.ts";
import { TaskContainer } from "@freeanima/shared/pg-shapes/entity/enums.ts";

import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getSubjectKind } from "@freeanima/client/portal-sdk";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import {
  offlineCreateCalendarEvent,
  offlineDeleteCalendarEvent,
  offlineUpdateCalendarEvent,
  registerCalendarOfflineModule,
} from "./offline-store.ts";

export type SubjectKind = NotificationRecipientKind;
export type CalendarEventRow = CalendarEventRowPayload;
export type CalendarRangeItem = CalendarRangeItemPayload;
export type { CalendarRangeKind };
export type BuiltinCalendarSourceId = BuiltinCalendarSourceIdPayload;

let calendarModuleRegistered = false;

function ensureCalendarOfflineModule(): void {
  if (calendarModuleRegistered) return;
  registerCalendarOfflineModule();
  calendarModuleRegistered = true;
}

function habitat() {
  return getTypedHabitatClient();
}

function taskRowToRangeItem(row: TaskItemRowPayload): CalendarRangeItem {
  return {
    kind: "task",
    id: row.id,
    title: row.title,
    start_at: row.start_at ?? null,
    end_at: row.end_at ?? null,
    due_at: row.due_at,
    status: row.status === "completed" ? "completed" : "pending",
    priority: row.priority ?? "none",
    project_id: row.project_id ?? null,
    list_id: row.list_id ?? null,
  };
}

/** 议程用：按截止日拉取 pending 根任务（含项目内、仅有 due_at） */
export async function fetchDueTasksForAgenda(
  subjectKind: SubjectKind,
  filters: TaskItemSearchFiltersPayload,
): Promise<CalendarRangeItem[]> {
  try {
    const data = await habitat().call("tasklist.item.list", {
      subject_kind: subjectKind,
      filters: { ...filters, container: TaskContainer.ANY },
      roots_only: true,
      limit: 500,
    });
    return data.items.map(taskRowToRangeItem);
  } catch {
    return [];
  }
}

/** 日历拖拽改任务 due（仅此一次） */
export async function patchTaskDueAt(
  subjectKind: SubjectKind,
  taskId: number,
  day: string,
): Promise<void> {
  const due_at = `${day}T09:00:00+08:00`;
  await habitat().call("task.patch", {
    subject_kind: subjectKind,
    id: taskId,
    due_at,
    only_this: true,
  });
}

export async function fetchCalendarRange(
  subjectKind: SubjectKind,
  opts: {
    from: string;
    to: string;
    kinds?: CalendarRangeKind[];
    sources?: BuiltinCalendarSourceId[];
    include_completed?: boolean;
  },
): Promise<CalendarRangeItem[]> {
  const scope = resolveHabitatCacheScope();
  const kindsKey = (opts.kinds ?? []).join(",");
  const sourcesKey = (opts.sources ?? []).join(",");
  const completedKey = opts.include_completed ? "1" : "0";
  return withOfflineCache({
    scope,
    namespace: "calendar",
    id: `range:${opts.from}:${opts.to}:${kindsKey}:${sourcesKey}:${completedKey}`,
    fetch: async () => {
      const data = await habitat().call("calendar.range", {
        subject_kind: subjectKind,
        from: opts.from,
        to: opts.to,
        ...(opts.kinds?.length ? { kinds: opts.kinds } : {}),
        ...(opts.sources?.length ? { sources: opts.sources } : {}),
        ...(opts.include_completed ? { include_completed: true } : {}),
      });
      return data.items;
    },
    offlineError: "calendar.range unavailable offline",
  });
}

export async function fetchCalendarPrefs(
  subjectKind: SubjectKind,
): Promise<CalendarUiPrefsPayload> {
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "calendar",
    id: `prefs:${subjectKind}`,
    fetch: async () => {
      const data = await habitat().call("calendar.prefs.get", { subject_kind: subjectKind });
      return data.prefs;
    },
    offlineError: "calendar.prefs unavailable offline",
  });
}

export async function updateCalendarPrefs(
  subjectKind: SubjectKind,
  patch: {
    viewMode?: CalendarUiPrefsPayload["viewMode"];
    byView?: Partial<
      Record<CalendarUiPrefsPayload["viewMode"], Partial<CalendarUiPrefsPayload["byView"]["day"]>>
    >;
  },
): Promise<CalendarUiPrefsPayload> {
  const data = await habitat().call("calendar.prefs.update", {
    subject_kind: subjectKind,
    ...patch,
  });
  return data.prefs;
}

export type { CalendarUiPrefsPayload };

export async function createCalendarEvent(
  subjectKind: SubjectKind,
  input: {
    title: string;
    content?: string;
    start_at: string;
    end_at?: string | null;
    all_day?: boolean;
    remind_at?: string | null;
    reminders?: Array<{ at: string; anchor?: "start" | "end" | "due" }>;
    client_op_id?: string;
  },
): Promise<CalendarEventRow> {
  ensureCalendarOfflineModule();
  return offlineCreateCalendarEvent(subjectKind, input);
}

export async function updateCalendarEvent(
  subjectKind: SubjectKind,
  input: {
    id: number;
    title?: string;
    content?: string;
    start_at?: string;
    end_at?: string | null;
    all_day?: boolean;
    remind_at?: string | null;
    reminders?: Array<{ at: string; anchor?: "start" | "end" | "due" }>;
  },
): Promise<CalendarEventRow> {
  ensureCalendarOfflineModule();
  return offlineUpdateCalendarEvent(subjectKind, input);
}

export async function deleteCalendarEvent(subjectKind: SubjectKind, id: number): Promise<void> {
  ensureCalendarOfflineModule();
  await offlineDeleteCalendarEvent(subjectKind, id);
}

/** 按 id 拉取单条日历事件；先当前 subject，失败再试另一侧。 */
export async function fetchCalendarEventById(id: number): Promise<CalendarEventRow | null> {
  const primary = getSubjectKind();
  const kinds = primary === "agent" ? (["agent", "user"] as const) : (["user", "agent"] as const);
  for (const subject_kind of kinds) {
    try {
      const data = await habitat().call("calendar.get", { subject_kind, id });
      return data.item;
    } catch {
      // try next subject_kind
    }
  }
  return null;
}

export async function convertCalendarEventToTask(
  subjectKind: SubjectKind,
  id: number,
): Promise<{ id: number; title: string }> {
  const data = await habitat().call("calendar.convertToTask", {
    subject_kind: subjectKind,
    id,
  });
  return { id: data.item.id, title: data.item.title };
}
