import {
  CALENDAR_EVENT_COMPONENT,
  TASK_ITEM_COMPONENT,
  asCalendarEvent,
  asTaskItem,
  normalizeSchedulableReminders,
  type SchedulableReminderEntry,
} from "@freeanima/habitat/core/db/schema/entity";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config";
import { searchEntities, updateEntity } from "@freeanima/habitat/core/db/pg/entity";
import { formatCstIso } from "@freeanima/habitat/core/util";
import { getNotificationPort } from "@freeanima/habitat/capabilities/tools/notification";
import type { NotificationRecipientRef } from "@freeanima/habitat/capabilities/tools/notification";

import { emitTaskAdvanceReminder } from "./task-advance-reminder-events.ts";

export type TaskReminderSchedulable = {
  due_at?: string | null;
  remind_at?: string | null;
  reminders?: SchedulableReminderEntry[] | null;
  last_notified_at?: string | null;
};

/** 日程提醒：走 reminders[]；缺省可用 start 作为单条 remind（不把 start 伪装成 due） */
export type CalendarEventReminderSchedulable = {
  start_at?: string | null;
  remind_at?: string | null;
  reminders?: SchedulableReminderEntry[] | null;
  last_notified_at?: string | null;
};

function taskReminderFields(item: {
  title: string;
  due_at?: string | null | undefined;
  remind_at?: string | null | undefined;
  reminders?: SchedulableReminderEntry[] | null | undefined;
  last_notified_at?: string | null | undefined;
}): TaskReminderSchedulable & { title: string } {
  return {
    title: item.title,
    ...(item.due_at !== undefined ? { due_at: item.due_at } : {}),
    ...(item.remind_at !== undefined ? { remind_at: item.remind_at } : {}),
    ...(item.reminders !== undefined ? { reminders: item.reminders } : {}),
    ...(item.last_notified_at !== undefined ? { last_notified_at: item.last_notified_at } : {}),
  };
}

/** @deprecated 旧 remind-else-due；测试兼容保留，新逻辑用 dueTriggerMs / listAdvanceReminders */
export function triggerMs(item: TaskReminderSchedulable): number | null {
  const advances = listAdvanceReminders(item);
  const firstAt = advances[0]?.at;
  if (firstAt) {
    const first = Date.parse(firstAt);
    if (Number.isFinite(first)) return first;
  }
  return dueTriggerMs(item);
}

export function dueTriggerMs(item: TaskReminderSchedulable): number | null {
  const due = item.due_at ? Date.parse(item.due_at) : NaN;
  return Number.isFinite(due) ? due : null;
}

export function listAdvanceReminders(item: TaskReminderSchedulable): SchedulableReminderEntry[] {
  return normalizeSchedulableReminders({
    remind_at: item.remind_at,
    reminders: item.reminders,
  }).reminders;
}

/** 事件提醒列表：reminders 真源；空则用 start 作为单条 remind */
export function listCalendarEventReminders(
  item: CalendarEventReminderSchedulable,
): SchedulableReminderEntry[] {
  const normalized = normalizeSchedulableReminders({
    remind_at: item.remind_at,
    reminders: item.reminders,
    defaultAnchor: "start",
  }).reminders;
  if (normalized.length > 0) return normalized;
  const start = item.start_at != null && item.start_at !== "" ? item.start_at : null;
  if (start == null) return [];
  return [{ at: start, anchor: "start" }];
}

export function calendarEventTriggerMs(item: CalendarEventReminderSchedulable): number | null {
  const first = listCalendarEventReminders(item)[0]?.at;
  if (!first) return null;
  const ms = Date.parse(first);
  return Number.isFinite(ms) ? ms : null;
}

export function shouldSendDueNotification(
  item: TaskReminderSchedulable,
  nowMs: number = Date.now(),
): boolean {
  const at = dueTriggerMs(item);
  if (at == null || at > nowMs) return false;
  const lastNotified = item.last_notified_at ? Date.parse(item.last_notified_at) : NaN;
  if (Number.isFinite(lastNotified) && lastNotified >= at) return false;
  return true;
}

export function shouldSendAdvanceReminder(
  entry: SchedulableReminderEntry,
  nowMs: number = Date.now(),
): boolean {
  const at = Date.parse(entry.at);
  if (!Number.isFinite(at) || at > nowMs) return false;
  const lastNotified = entry.last_notified_at ? Date.parse(entry.last_notified_at) : NaN;
  if (Number.isFinite(lastNotified) && lastNotified >= at) return false;
  return true;
}

/** @deprecated 旧合并语义：任务请拆 due/advance */
export function shouldSendTaskReminder(
  item: TaskReminderSchedulable,
  nowMs: number = Date.now(),
): boolean {
  if (shouldSendDueNotification(item, nowMs)) return true;
  return listAdvanceReminders(item).some((r) => shouldSendAdvanceReminder(r, nowMs));
}

export function shouldSendCalendarEventReminder(
  item: CalendarEventReminderSchedulable,
  nowMs: number = Date.now(),
): boolean {
  return listCalendarEventReminders(item).some((r) => {
    const withLegacyLast =
      r.last_notified_at != null || item.last_notified_at == null
        ? r
        : { ...r, last_notified_at: item.last_notified_at };
    return shouldSendAdvanceReminder(withLegacyLast, nowMs);
  });
}

export function taskReminderSourceRef(taskItemId: number, triggerAtMs: number): string {
  return `task_item:${taskItemId}:trigger:${new Date(triggerAtMs).toISOString()}`;
}

export function taskAdvanceReminderSourceRef(taskItemId: number, triggerAtMs: number): string {
  return `task_item:${taskItemId}:advance:${new Date(triggerAtMs).toISOString()}`;
}

export function calendarEventReminderSourceRef(eventId: number, triggerAtMs: number): string {
  return `calendar_event:${eventId}:trigger:${new Date(triggerAtMs).toISOString()}`;
}

function buildDueBody(item: TaskReminderSchedulable & { title: string }): string {
  const dueLine = item.due_at ? `截止时间：${item.due_at}` : "";
  return dueLine || item.title;
}

function buildAdvanceBody(item: TaskReminderSchedulable & { title: string }, at: string): string {
  const lines = [`提醒时间：${at}`, item.due_at ? `截止时间：${item.due_at}` : ""].filter(Boolean);
  return lines.join("\n") || item.title;
}

function buildCalendarReminderBody(
  item: CalendarEventReminderSchedulable & { title: string },
  at: string,
): string {
  const startLine = item.start_at ? `开始时间：${item.start_at}` : "";
  const remindLine = `提醒时间：${at}`;
  return [startLine, remindLine].filter(Boolean).join("\n") || item.title;
}

/** 将 entity 所属 world 映射到通知收件人；未知 world 返回 null */
export function recipientForTaskWorld(
  worldId: number,
  port: {
    getUserRecipient(): NotificationRecipientRef;
    getAgentRecipient(): NotificationRecipientRef;
  },
): NotificationRecipientRef | null {
  const ctx = getResolvedWorldContext();
  if (worldId === ctx.user_world_id) return port.getUserRecipient();
  if (worldId === ctx.agent_world_id) return port.getAgentRecipient();
  return null;
}

type ReminderPort = NonNullable<ReturnType<typeof getNotificationPort>>;

export type TaskReminderScanStats = {
  sent: number;
  due_inbox: number;
  advance_alerts: number;
  scanned: number;
  skipped_unknown_world: number;
};

/** 查询下一火时刻（ms）；无则 null */
export function nextFireMsFromSchedulable(
  item: TaskReminderSchedulable,
  nowMs: number = Date.now(),
): number | null {
  const candidates: number[] = [];
  const due = dueTriggerMs(item);
  if (due != null && due > nowMs) {
    const lastNotified = item.last_notified_at ? Date.parse(item.last_notified_at) : NaN;
    if (!Number.isFinite(lastNotified) || lastNotified < due) candidates.push(due);
  } else if (due != null && shouldSendDueNotification(item, nowMs)) {
    candidates.push(nowMs);
  }
  for (const r of listAdvanceReminders(item)) {
    const at = Date.parse(r.at);
    if (!Number.isFinite(at)) continue;
    if (shouldSendAdvanceReminder(r, nowMs)) {
      candidates.push(nowMs);
      continue;
    }
    if (at > nowMs) candidates.push(at);
  }
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

export function nextFireMsFromCalendarEvent(
  item: CalendarEventReminderSchedulable,
  nowMs: number = Date.now(),
): number | null {
  if (shouldSendCalendarEventReminder(item, nowMs)) return nowMs;
  const candidates: number[] = [];
  for (const r of listCalendarEventReminders(item)) {
    const at = Date.parse(r.at);
    if (!Number.isFinite(at)) continue;
    if (at > nowMs) candidates.push(at);
  }
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

async function scanTaskReminders(port: ReminderPort, now: number): Promise<TaskReminderScanStats> {
  const ctx = getResolvedWorldContext();
  const search = await searchEntities({
    component: TASK_ITEM_COMPONENT,
    filters: { status: "pending" },
    limit: 500,
    mode: "filter_only",
    global: true,
    accessible_world_ids: [ctx.user_world_id, ctx.agent_world_id],
  });

  let dueInbox = 0;
  let advanceAlerts = 0;
  let skippedUnknownWorld = 0;
  for (const row of search.results) {
    const item = asTaskItem(row);
    if (!item || item.status === "completed") continue;
    const schedulable = taskReminderFields(item);

    const recipient = recipientForTaskWorld(row.world_id, port);
    if (!recipient) {
      if (
        shouldSendDueNotification(schedulable, now) ||
        listAdvanceReminders(schedulable).some((r) => shouldSendAdvanceReminder(r, now))
      ) {
        skippedUnknownWorld += 1;
      }
      continue;
    }

    if (shouldSendDueNotification(schedulable, now)) {
      const at = dueTriggerMs(schedulable);
      if (at != null) {
        await port.create({
          recipient_kind: recipient.kind,
          recipient_id: recipient.id,
          title: `任务到期：${item.title}`,
          body: buildDueBody(schedulable),
          source_kind: "system",
          source_ref: taskReminderSourceRef(item.id, at),
          payload: { task_item_id: item.id, kind: "due" },
        });
        await updateEntity({
          id: item.id,
          body: { last_notified_at: formatCstIso(new Date()) },
        });
        dueInbox += 1;
      }
    }

    const normalized = listAdvanceReminders(schedulable);
    if (normalized.length === 0) continue;

    let remindersChanged = false;
    const nextReminders = normalized.map((entry) => {
      if (!shouldSendAdvanceReminder(entry, now)) return entry;
      const at = Date.parse(entry.at);
      if (!Number.isFinite(at)) return entry;
      // 仅 user world 发本机 Alert（与 Inbox Alert 策略一致）；agent 只记已通知避免重扫
      if (recipient.kind === "user") {
        emitTaskAdvanceReminder({
          task_item_id: item.id,
          title: `任务提醒：${item.title}`,
          body: buildAdvanceBody(schedulable, entry.at),
          at: entry.at,
          source_ref: taskAdvanceReminderSourceRef(item.id, at),
        });
      }
      advanceAlerts += 1;
      remindersChanged = true;
      return { ...entry, last_notified_at: formatCstIso(new Date()) };
    });

    if (remindersChanged) {
      const synced = normalizeSchedulableReminders({ reminders: nextReminders });
      await updateEntity({
        id: item.id,
        body: {
          reminders: synced.reminders,
          remind_at: synced.remind_at,
        },
      });
    }
  }

  return {
    sent: dueInbox + advanceAlerts,
    due_inbox: dueInbox,
    advance_alerts: advanceAlerts,
    scanned: search.results.length,
    skipped_unknown_world: skippedUnknownWorld,
  };
}

async function scanCalendarEventReminders(
  port: ReminderPort,
  now: number,
): Promise<{ sent: number; scanned: number; skipped_unknown_world: number }> {
  const ctx = getResolvedWorldContext();
  const search = await searchEntities({
    primary_component: CALENDAR_EVENT_COMPONENT,
    limit: 500,
    mode: "filter_only",
    global: true,
    accessible_world_ids: [ctx.user_world_id, ctx.agent_world_id],
  });

  let sent = 0;
  let skippedUnknownWorld = 0;
  for (const row of search.results) {
    const item = asCalendarEvent(row);
    if (!item) continue;
    const schedulable: CalendarEventReminderSchedulable & { title: string } = {
      title: item.title,
      start_at: item.start_at,
      remind_at: item.remind_at ?? null,
      reminders: item.reminders ?? null,
      last_notified_at: item.last_notified_at ?? null,
    };
    if (!shouldSendCalendarEventReminder(schedulable, now)) continue;

    const recipient = recipientForTaskWorld(row.world_id, port);
    if (!recipient) {
      skippedUnknownWorld += 1;
      continue;
    }

    const listed = listCalendarEventReminders(schedulable).map((r) =>
      r.last_notified_at != null || schedulable.last_notified_at == null
        ? r
        : { ...r, last_notified_at: schedulable.last_notified_at },
    );
    const dueEntries = listed.filter((entry) => shouldSendAdvanceReminder(entry, now));
    if (dueEntries.length === 0) continue;

    const notifiedAt = formatCstIso(new Date());
    for (const entry of dueEntries) {
      const at = Date.parse(entry.at);
      if (!Number.isFinite(at)) continue;
      await port.create({
        recipient_kind: recipient.kind,
        recipient_id: recipient.id,
        title: `日程提醒：${item.title}`,
        body: buildCalendarReminderBody(schedulable, entry.at),
        source_kind: "system",
        source_ref: calendarEventReminderSourceRef(item.id, at),
        payload: { calendar_event_id: item.id },
      });
      sent += 1;
    }

    const isSyntheticStart =
      (!item.reminders || item.reminders.length === 0) &&
      (item.remind_at == null || item.remind_at === "");

    if (isSyntheticStart) {
      await updateEntity({
        id: item.id,
        body: { last_notified_at: notifiedAt },
      });
      continue;
    }

    const firedAts = new Set(dueEntries.map((e) => e.at));
    const nextReminders = listed.map((entry) =>
      firedAts.has(entry.at) ? { ...entry, last_notified_at: notifiedAt } : entry,
    );
    const synced = normalizeSchedulableReminders({
      reminders: nextReminders,
      defaultAnchor: "start",
    });
    await updateEntity({
      id: item.id,
      body: {
        reminders: synced.reminders,
        remind_at: synced.remind_at,
        last_notified_at: notifiedAt,
      },
    });
  }

  return { sent, scanned: search.results.length, skipped_unknown_world: skippedUnknownWorld };
}

/** 扫描到期任务与日程事件：due→Inbox；advance→本机 Alert；事件 reminders→Inbox */
export async function runTaskReminderScan(): Promise<string> {
  const port = getNotificationPort();
  if (!port) {
    return JSON.stringify({ ok: false, error: "notification port unavailable" });
  }

  const now = Date.now();
  const tasks = await scanTaskReminders(port, now);
  const events = await scanCalendarEventReminders(port, now);

  return JSON.stringify({
    ok: true,
    sent: tasks.sent + events.sent,
    scanned: tasks.scanned + events.scanned,
    skipped_unknown_world: tasks.skipped_unknown_world + events.skipped_unknown_world,
    tasks,
    calendar_events: events,
  });
}

/** 供 sleep-until-next 计算下一火时刻 */
export async function queryEarliestTaskReminderFireMs(
  nowMs: number = Date.now(),
): Promise<number | null> {
  const ctx = getResolvedWorldContext();
  const search = await searchEntities({
    component: TASK_ITEM_COMPONENT,
    filters: { status: "pending" },
    limit: 500,
    mode: "filter_only",
    global: true,
    accessible_world_ids: [ctx.user_world_id, ctx.agent_world_id],
  });
  let earliest: number | null = null;
  for (const row of search.results) {
    const item = asTaskItem(row);
    if (!item || item.status === "completed") continue;
    const next = nextFireMsFromSchedulable(taskReminderFields(item), nowMs);
    if (next == null) continue;
    if (earliest == null || next < earliest) earliest = next;
  }

  const calSearch = await searchEntities({
    primary_component: CALENDAR_EVENT_COMPONENT,
    limit: 500,
    mode: "filter_only",
    global: true,
    accessible_world_ids: [ctx.user_world_id, ctx.agent_world_id],
  });
  for (const row of calSearch.results) {
    const item = asCalendarEvent(row);
    if (!item) continue;
    const next = nextFireMsFromCalendarEvent(
      {
        start_at: item.start_at,
        remind_at: item.remind_at ?? null,
        reminders: item.reminders ?? null,
        last_notified_at: item.last_notified_at ?? null,
      },
      nowMs,
    );
    if (next == null) continue;
    if (earliest == null || next < earliest) earliest = next;
  }
  return earliest;
}
