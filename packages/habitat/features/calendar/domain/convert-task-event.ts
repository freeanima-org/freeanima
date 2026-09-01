import {
  CALENDAR_EVENT_COMPONENT,
  TASK_ITEM_COMPONENT,
  asCalendarEvent,
  asTaskItem,
  normalizeSchedulableReminders,
  taskPlanClock,
  type CalendarEventBody,
  type TaskItemBody,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  assertEntityInWorld,
  deleteEntity,
  getEntity,
  replacePrimaryComponent,
} from "@freeanima/habitat/core/db/pg/entity";
import { rescheduleTaskReminderScheduler } from "@freeanima/habitat/platform/boot/task-reminder-scheduler.ts";

import { ensureDefaultTaskListForWorld } from "@freeanima/features/task/domain/list-store.ts";
import { deleteOccurrencesForSeries } from "@freeanima/features/task/domain/occurrence-store.ts";
import { nextPrependSortOrder } from "@freeanima/shared/task/sort-order.ts";
import { getTaskItem, listTaskItems } from "@freeanima/features/task/domain/item-store.ts";
import type { TaskItemRow } from "@freeanima/features/task/domain/types.ts";
import { TaskContainer } from "@freeanima/shared/pg-shapes/entity/enums.ts";

import type { CalendarEventRow, CalendarStoreContext, CalendarReminderEntry } from "./types.ts";

function touchReminderScheduler(): void {
  try {
    rescheduleTaskReminderScheduler();
  } catch {
    /* scheduler may be unset in unit tests */
  }
}

function toCalendarReminders(
  reminders: ReadonlyArray<{ at: string } & Record<string, unknown>>,
): CalendarReminderEntry[] {
  return reminders.map((r) => {
    const entry: CalendarReminderEntry = { at: r.at };
    const anchor = r.anchor;
    if (anchor === "start" || anchor === "end" || anchor === "due") {
      entry.anchor = anchor;
    }
    if ("last_notified_at" in r) {
      const last = r.last_notified_at;
      entry.last_notified_at = last === null || typeof last === "string" ? last : null;
    }
    return entry;
  });
}

/** 有损：task_item → calendar_event（丢弃 recurrence / 归属 / deadline / 状态等） */
export function mapTaskItemBodyToCalendarEvent(task: {
  start_at?: string | null;
  end_at?: string | null;
  due_at?: string | null;
  remind_at?: string | null;
  reminders?: ReadonlyArray<{
    at: string;
    anchor?: string | null;
    last_notified_at?: string | null;
  }> | null;
}): CalendarEventBody {
  const start = task.start_at != null && task.start_at !== "" ? task.start_at : null;
  const end = task.end_at != null && task.end_at !== "" ? task.end_at : null;
  if (start == null || taskPlanClock({ start_at: start, end_at: end }) == null) {
    throw new Error("task requires planned time (start_at) to convert to event");
  }
  const reminders = normalizeSchedulableReminders({
    remind_at: task.remind_at,
    reminders: (task.reminders ?? undefined)?.map((r) => ({
      at: r.at,
      ...(r.anchor === "start" || r.anchor === "end" || r.anchor === "due"
        ? { anchor: r.anchor }
        : {}),
      ...(r.last_notified_at !== undefined ? { last_notified_at: r.last_notified_at } : {}),
    })),
    defaultAnchor: "start",
  });
  const eventReminders = reminders.reminders.map((r) => ({
    at: r.at,
    anchor: "start" as const,
    ...(r.last_notified_at !== undefined ? { last_notified_at: r.last_notified_at } : {}),
  }));
  const normalized = normalizeSchedulableReminders({
    reminders: eventReminders,
    defaultAnchor: "start",
  });
  return {
    start_at: start,
    end_at: end,
    all_day: false,
    remind_at: normalized.remind_at,
    reminders: normalized.reminders,
    last_notified_at: null,
  };
}

/** 有损：calendar_event → task_item；计划 1:1，不自动填 deadline */
export function mapCalendarEventBodyToTaskItemFields(
  event: {
    start_at: string;
    end_at?: string | null;
    remind_at?: string | null;
    reminders?: ReadonlyArray<{
      at: string;
      anchor?: string | null;
      last_notified_at?: string | null;
    }> | null;
  },
  opts: { list_id: number; sort_order: number },
): TaskItemBody {
  const start_at = event.start_at;
  const end_at = event.end_at != null && event.end_at !== "" ? event.end_at : null;
  const reminders = normalizeSchedulableReminders({
    remind_at: event.remind_at ?? null,
    reminders: (event.reminders ?? undefined)?.map((r) => ({
      at: r.at,
      ...(r.anchor === "start" || r.anchor === "end" || r.anchor === "due"
        ? { anchor: r.anchor }
        : {}),
      ...(r.last_notified_at !== undefined ? { last_notified_at: r.last_notified_at } : {}),
    })),
    defaultAnchor: "start",
  });
  return {
    status: "pending",
    priority: "none",
    list_id: opts.list_id,
    project_id: null,
    sort_order: opts.sort_order,
    start_at,
    end_at,
    due_at: null,
    remind_at: reminders.remind_at,
    reminders: reminders.reminders,
    completed_at: null,
    parent_id: null,
    recurrence: null,
  };
}

function toEventRowFromEntity(
  row: NonNullable<Awaited<ReturnType<typeof getEntity>>>,
): CalendarEventRow {
  const parsed = asCalendarEvent(row);
  if (!parsed) throw new Error("calendar event retype failed");
  const reminders = normalizeSchedulableReminders({
    remind_at: parsed.remind_at,
    reminders: parsed.reminders,
    defaultAnchor: "start",
  });
  const base = {
    id: parsed.id,
    title: parsed.title,
    content: parsed.content,
    start_at: parsed.start_at,
    end_at: parsed.end_at ?? null,
    all_day: parsed.all_day ?? false,
    remind_at: reminders.remind_at,
    tag_ids: [...(row.tag_ids ?? [])],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
  if (reminders.reminders.length > 0) {
    return { ...base, reminders: toCalendarReminders(reminders.reminders) };
  }
  return base;
}

/** 任务 → 事件（同 id retype）；仅 pending 根任务且须有计划时间 */
export async function convertTaskItemToCalendarEvent(
  worldId: number,
  id: number,
): Promise<CalendarEventRow> {
  const existing = await getEntity(id);
  if (!existing) throw new Error("task not found");
  await assertEntityInWorld(id, worldId);
  if (existing.primary_component !== TASK_ITEM_COMPONENT) {
    throw new Error("only primary task_item can convert to event");
  }
  const parsed = asTaskItem(existing);
  if (!parsed) throw new Error("task not found");
  if (parsed.status !== "pending") throw new Error("only pending tasks can convert to event");
  if (parsed.parent_id != null) throw new Error("subtasks cannot convert to event");

  const eventBody = mapTaskItemBodyToCalendarEvent({
    start_at: parsed.start_at ?? null,
    end_at: parsed.end_at ?? null,
    due_at: parsed.due_at ?? null,
    remind_at: parsed.remind_at ?? null,
    reminders: parsed.reminders ? toCalendarReminders(parsed.reminders) : null,
  });

  await deleteOccurrencesForSeries(worldId, id);
  const children = await listTaskItems(worldId, {
    parent_id: id,
    roots_only: false,
    container: TaskContainer.ANY,
    ...(parsed.project_id != null
      ? { project_id: parsed.project_id }
      : parsed.list_id != null
        ? { list_id: parsed.list_id }
        : {}),
  });
  for (const child of children) {
    await deleteEntity(child.id);
  }

  const row = await replacePrimaryComponent({
    id,
    from: TASK_ITEM_COMPONENT,
    to: CALENDAR_EVENT_COMPONENT,
    body: eventBody,
  });
  if (!row) throw new Error("convert to event failed");
  touchReminderScheduler();
  return toEventRowFromEntity(row);
}

/** 事件 → 任务（同 id retype）；落入默认 Inbox */
export async function convertCalendarEventToTaskItem(
  ctx: CalendarStoreContext,
  id: number,
): Promise<TaskItemRow> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== CALENDAR_EVENT_COMPONENT) {
    throw new Error("calendar event not found");
  }
  if (existing.world_id !== ctx.worldId) throw new Error("calendar event not found");
  const parsed = asCalendarEvent(existing);
  if (!parsed) throw new Error("calendar event not found");

  const inbox = await ensureDefaultTaskListForWorld(ctx.worldId);
  const siblings = await listTaskItems(ctx.worldId, {
    list_id: inbox.id,
    status: "pending",
  });
  const sort_order = nextPrependSortOrder(siblings.map((s) => s.sort_order));
  const taskBody = mapCalendarEventBodyToTaskItemFields(
    {
      start_at: parsed.start_at,
      end_at: parsed.end_at ?? null,
      remind_at: parsed.remind_at ?? null,
      reminders: parsed.reminders ? toCalendarReminders(parsed.reminders) : null,
    },
    {
      list_id: inbox.id,
      sort_order,
    },
  );

  const row = await replacePrimaryComponent({
    id,
    from: CALENDAR_EVENT_COMPONENT,
    to: TASK_ITEM_COMPONENT,
    body: taskBody,
  });
  if (!row) throw new Error("convert to task failed");
  touchReminderScheduler();
  const item = await getTaskItem(ctx.worldId, id);
  if (!item) throw new Error("convert to task failed");
  return item;
}
