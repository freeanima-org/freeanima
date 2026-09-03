/// <reference lib="dom" />
import { getUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import {
  dueFiltersForAgenda,
  filterEndedEvents,
  mergeCalendarItems,
  planOverdueFiltersForAgenda,
} from "@freeanima/features/calendar/ui/spa/lib/agenda-items.ts";
import {
  fetchCalendarRange,
  fetchDueTasksForAgenda,
  type CalendarRangeItem,
} from "@freeanima/features/calendar/ui/spa/lib/api.ts";
import {
  dayRangeIso,
  todayDateLocalValue,
} from "@freeanima/features/calendar/ui/spa/lib/format-calendar.ts";
import type { TaskItemRowPayload } from "@freeanima/shared/rpc-contract/frames/task.ts";
import { TaskContainer } from "@freeanima/shared/pg-shapes/entity/enums.ts";

export type PomodoroLinkPickRow =
  | {
      kind: "task";
      id: number;
      title: string;
      status: "pending" | "completed";
      list_name: string | null;
      project_title: string | null;
      project_id: number | null;
      list_id: number | null;
      updated_at: string;
    }
  | {
      kind: "event";
      id: number;
      title: string;
    };

/** @deprecated 使用 PomodoroLinkPickRow */
export type PomodoroTaskPickRow = Extract<PomodoroLinkPickRow, { kind: "task" }>;

const PICK_LIMIT = 40;

function habitat() {
  return getTypedHabitatClient();
}

async function withSubjectId<T extends Record<string, unknown>>(payload: T) {
  return { subject_id: await getUserSubjectId(), ...payload };
}

/** 列表行左侧 badge：清单名 / 项目名 /「事件」 */
export function pomodoroLinkBadgeLabel(row: PomodoroLinkPickRow): string {
  if (row.kind === "event") return "事件";
  if (row.project_id != null) {
    const title = row.project_title?.trim();
    return title && title.length > 0 ? title : "项目";
  }
  const listName = row.list_name?.trim();
  if (listName && listName.length > 0) return listName;
  if (row.list_id != null) return "清单";
  return "任务";
}

/** 紧凑文案（迷你窗 / 关联区）：badge · 标题 */
export function formatPomodoroLinkLabel(row: PomodoroLinkPickRow): string {
  return `${pomodoroLinkBadgeLabel(row)} · ${row.title}`;
}

function taskRowToPick(row: TaskItemRowPayload): PomodoroLinkPickRow {
  return {
    kind: "task",
    id: row.id,
    title: row.title,
    status: row.status === "completed" ? "completed" : "pending",
    list_name: row.list_name ?? null,
    project_title: row.project_title ?? null,
    project_id: row.project_id ?? null,
    list_id: row.list_id ?? null,
    updated_at: row.updated_at,
  };
}

function eventItemToPick(item: Extract<CalendarRangeItem, { kind: "event" }>): PomodoroLinkPickRow {
  return { kind: "event", id: item.id, title: item.title };
}

function rangeTaskToPick(item: Extract<CalendarRangeItem, { kind: "task" }>): PomodoroLinkPickRow {
  return {
    kind: "task",
    id: item.id,
    title: item.title,
    status: item.status === "completed" ? "completed" : "pending",
    list_name: null,
    project_title: null,
    project_id: item.project_id,
    list_id: item.list_id,
    updated_at: item.end_at ?? item.start_at ?? item.due_at ?? "",
  };
}

function pickKey(row: PomodoroLinkPickRow): string {
  return `${row.kind}-${row.id}`;
}

/** 合并候选：任务优先保留带归属字段的行 */
export function mergePomodoroLinkRows(rows: PomodoroLinkPickRow[]): PomodoroLinkPickRow[] {
  const map = new Map<string, PomodoroLinkPickRow>();
  for (const row of rows) {
    const key = pickKey(row);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    if (row.kind === "task" && prev.kind === "task") {
      const prevHasAttr = prev.list_name != null || prev.project_title != null;
      const nextHasAttr = row.list_name != null || row.project_title != null;
      if (nextHasAttr && !prevHasAttr) map.set(key, row);
    }
  }
  return [...map.values()];
}

async function enrichTaskAttribution(rows: PomodoroLinkPickRow[]): Promise<PomodoroLinkPickRow[]> {
  const tasks = rows.filter((row): row is Extract<PomodoroLinkPickRow, { kind: "task" }> => {
    if (row.kind !== "task") return false;
    if (row.project_id != null && !row.project_title?.trim()) return true;
    if (row.list_id != null && !row.list_name?.trim()) return true;
    return false;
  });
  if (tasks.length === 0) return rows;

  const needProjects = new Set<number>();
  const needLists = new Set<number>();
  for (const task of tasks) {
    if (task.project_id != null && !task.project_title?.trim()) needProjects.add(task.project_id);
    if (task.list_id != null && !task.list_name?.trim()) needLists.add(task.list_id);
  }

  const projectTitles = new Map<number, string>();
  const listNames = new Map<number, string>();

  if (needProjects.size > 0) {
    try {
      const data = await habitat().call("project.list", await withSubjectId({}));
      for (const project of data.projects ?? []) {
        if (needProjects.has(project.id)) {
          projectTitles.set(project.id, project.title);
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (needLists.size > 0) {
    try {
      const data = await habitat().call("tasklist.list", await withSubjectId({}));
      for (const list of data.lists ?? []) {
        if (needLists.has(list.id)) {
          listNames.set(list.id, list.name);
        }
      }
    } catch {
      /* ignore */
    }
  }

  return rows.map((row) => {
    if (row.kind !== "task") return row;
    let next = row;
    if (row.project_id != null && !row.project_title?.trim()) {
      const title = projectTitles.get(row.project_id);
      if (title) next = { ...next, project_title: title };
    }
    if (row.list_id != null && !row.list_name?.trim()) {
      const name = listNames.get(row.list_id);
      if (name) next = { ...next, list_name: name };
    }
    return next;
  });
}

export function filterPomodoroAgendaCandidates(
  items: CalendarRangeItem[],
  today: string,
  now: Date = new Date(),
): CalendarRangeItem[] {
  const visible = filterEndedEvents(items, now, today);
  return visible.filter((item) => {
    if (item.kind === "event") return true;
    if (item.kind === "task") return item.status === "pending" && !item.virtual;
    return false;
  });
}

async function fetchTaskRowsByFilters(
  subjectId: number,
  filters: Record<string, unknown>,
): Promise<TaskItemRowPayload[]> {
  try {
    const data = await habitat().call("tasklist.item.list", {
      subject_id: subjectId,
      filters: { ...filters, container: TaskContainer.ANY },
      roots_only: true,
      limit: 500,
    });
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function fetchTodayAgendaLinkRows(subjectId: number): Promise<PomodoroLinkPickRow[]> {
  const today = todayDateLocalValue();
  const range = dayRangeIso(today);
  const dueFilters = dueFiltersForAgenda("day", today, today);
  const planFilters = planOverdueFiltersForAgenda("day", today, today);

  const rangeItems = await fetchCalendarRange(subjectId, {
    from: range.from,
    to: range.to,
    kinds: ["event", "task"],
  });

  let merged = rangeItems;
  if (dueFilters) {
    merged = mergeCalendarItems(merged, await fetchDueTasksForAgenda(subjectId, dueFilters));
  }
  if (planFilters) {
    merged = mergeCalendarItems(merged, await fetchDueTasksForAgenda(subjectId, planFilters));
  }

  const candidates = filterPomodoroAgendaCandidates(merged, today);

  const taskIds = new Set(
    candidates
      .filter((item): item is Extract<CalendarRangeItem, { kind: "task" }> => item.kind === "task")
      .map((t) => t.id),
  );

  const attributedRows: PomodoroLinkPickRow[] = [];
  if (dueFilters) {
    for (const row of await fetchTaskRowsByFilters(subjectId, dueFilters)) {
      if (row.status === "pending") attributedRows.push(taskRowToPick(row));
    }
  }
  if (planFilters) {
    for (const row of await fetchTaskRowsByFilters(subjectId, planFilters)) {
      if (row.status === "pending") attributedRows.push(taskRowToPick(row));
    }
  }

  // 用 pending 全量补齐 range 内任务的归属（限制条数，避免过大）
  if (taskIds.size > 0) {
    const pending = await fetchTaskRowsByFilters(subjectId, { status: "pending" });
    for (const row of pending) {
      if (taskIds.has(row.id)) attributedRows.push(taskRowToPick(row));
    }
  }

  const fromRange: PomodoroLinkPickRow[] = [];
  for (const item of candidates) {
    if (item.kind === "event") fromRange.push(eventItemToPick(item));
    else if (item.kind === "task") fromRange.push(rangeTaskToPick(item));
  }

  return enrichTaskAttribution(
    mergePomodoroLinkRows([...attributedRows, ...fromRange]).slice(0, PICK_LIMIT),
  );
}

export async function searchPendingLinksForPicker(query: string): Promise<PomodoroLinkPickRow[]> {
  const q = query.trim();
  const subjectId = await getUserSubjectId();
  if (!q) return fetchTodayAgendaLinkRows(subjectId);

  const todayRows = await fetchTodayAgendaLinkRows(subjectId);
  const todayEvents = todayRows.filter((row) => row.kind === "event");
  const eventHits = todayEvents.filter((row) => row.title.toLowerCase().includes(q.toLowerCase()));

  const data = await habitat().call(
    "task.search",
    await withSubjectId({ query: q, status: "pending", limit: PICK_LIMIT }),
  );
  const tasks = (data.items ?? []).map(taskRowToPick);
  return enrichTaskAttribution(
    mergePomodoroLinkRows([...eventHits, ...tasks]).slice(0, PICK_LIMIT),
  );
}

/** @deprecated */
export async function searchPendingTasksForPicker(query: string): Promise<PomodoroLinkPickRow[]> {
  return searchPendingLinksForPicker(query);
}

/** @deprecated */
export async function fetchRecentPendingTasksForPicker(): Promise<PomodoroLinkPickRow[]> {
  return searchPendingLinksForPicker("");
}

export async function resolvePomodoroLinkLabel(opts: {
  taskItemId?: number | null;
  calendarEventId?: number | null;
  habitId?: number | null;
}): Promise<string | null> {
  const taskId = opts.taskItemId ?? null;
  const eventId = opts.calendarEventId ?? null;
  const habitId = opts.habitId ?? null;
  if (taskId == null && eventId == null && habitId == null) return null;

  if (taskId != null) {
    const today = await searchPendingLinksForPicker("");
    const hit = today.find((row) => row.kind === "task" && row.id === taskId);
    if (hit) return formatPomodoroLinkLabel(hit);

    const data = await habitat().call(
      "tasklist.item.list",
      await withSubjectId({ status: "all", limit: 200 }),
    );
    const items = data.items ?? [];
    const row = items.find((item) => item.id === taskId);
    if (row) return formatPomodoroLinkLabel(taskRowToPick(row));
    return `任务 #${taskId}`;
  }

  if (habitId != null) {
    try {
      const subjectId = await getUserSubjectId();
      const data = await habitat().call("habit.get", {
        subject_id: subjectId,
        id: habitId,
      });
      const title = data.item?.title;
      if (title) return `习惯 · ${title}`;
    } catch {
      /* ignore */
    }
    return `习惯 #${habitId}`;
  }

  const today = await searchPendingLinksForPicker("");
  const eventHit = today.find((row) => row.kind === "event" && row.id === eventId);
  if (eventHit) return formatPomodoroLinkLabel(eventHit);

  try {
    const subjectId = await getUserSubjectId();
    const day = todayDateLocalValue();
    const range = dayRangeIso(day);
    const items = await fetchCalendarRange(subjectId, {
      from: range.from,
      to: range.to,
      kinds: ["event"],
    });
    const found = items.find((item) => item.kind === "event" && item.id === eventId);
    if (found && found.kind === "event") return formatPomodoroLinkLabel(eventItemToPick(found));
  } catch {
    /* ignore */
  }
  return `事件 #${eventId}`;
}

/** @deprecated */
export async function resolveTaskTitleForPicker(taskId: number): Promise<string | null> {
  return resolvePomodoroLinkLabel({ taskItemId: taskId });
}
