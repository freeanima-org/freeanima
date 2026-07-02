import { TASK_ITEM_COMPONENT, asTaskItem } from "@freeanima/core/db/schema/entity";
import { getResolvedWorldContext } from "@freeanima/core/config";
import { searchEntities, updateEntity } from "@freeanima/core/db/pg/entity";
import { formatCstIso } from "@freeanima/core/util";
import { getNotificationPort } from "@freeanima/capabilities-tools/notification";

export type TaskReminderSchedulable = {
  due_at?: string | null;
  remind_at?: string | null;
  last_notified_at?: string | null;
};

function taskReminderFields(item: {
  title: string;
  due_at?: string | null | undefined;
  remind_at?: string | null | undefined;
  last_notified_at?: string | null | undefined;
}): TaskReminderSchedulable & { title: string } {
  return {
    title: item.title,
    ...(item.due_at !== undefined ? { due_at: item.due_at } : {}),
    ...(item.remind_at !== undefined ? { remind_at: item.remind_at } : {}),
    ...(item.last_notified_at !== undefined ? { last_notified_at: item.last_notified_at } : {}),
  };
}

/** remind_at 优先；无 remind_at 时用 due_at */
export function triggerMs(item: TaskReminderSchedulable): number | null {
  const remind = item.remind_at ? Date.parse(item.remind_at) : NaN;
  if (Number.isFinite(remind)) return remind;
  const due = item.due_at ? Date.parse(item.due_at) : NaN;
  return Number.isFinite(due) ? due : null;
}

export function shouldSendTaskReminder(
  item: TaskReminderSchedulable,
  nowMs: number = Date.now(),
): boolean {
  const at = triggerMs(item);
  if (at == null || at > nowMs) return false;
  const lastNotified = item.last_notified_at ? Date.parse(item.last_notified_at) : NaN;
  if (Number.isFinite(lastNotified) && lastNotified >= at) return false;
  return true;
}

export function taskReminderSourceRef(taskItemId: number, triggerAtMs: number): string {
  return `task_item:${taskItemId}:trigger:${new Date(triggerAtMs).toISOString()}`;
}

function buildReminderBody(item: TaskReminderSchedulable & { title: string }): string {
  const dueLine = item.due_at ? `截止时间：${item.due_at}` : "";
  const remindLine = item.remind_at ? `提醒时间：${item.remind_at}` : "";
  return [dueLine, remindLine].filter(Boolean).join("\n") || item.title;
}

/** 扫描到期/提醒时间已到的 pending 任务，向 agent 主体发通知（last_notified_at 去重） */
export async function runTaskReminderScan(): Promise<string> {
  const port = getNotificationPort();
  if (!port) {
    return JSON.stringify({ ok: false, error: "notification port unavailable" });
  }

  const agent = port.getAgentRecipient();
  const now = Date.now();
  const userWorldId = getResolvedWorldContext().user_world_id;
  const search = await searchEntities({
    world_id: userWorldId,
    primary_component: TASK_ITEM_COMPONENT,
    filters: { status: "pending" },
    limit: 500,
    mode: "filter_only",
  });

  let sent = 0;
  for (const row of search.results) {
    const item = asTaskItem(row);
    if (!item || item.status === "completed") continue;
    const schedulable = taskReminderFields(item);
    if (!shouldSendTaskReminder(schedulable, now)) continue;

    const at = triggerMs(schedulable);
    if (at == null) continue;
    const body = buildReminderBody(schedulable);
    const sourceRef = taskReminderSourceRef(item.id, at);

    await port.create({
      recipient_kind: agent.kind,
      recipient_id: agent.id,
      title: `任务到期：${item.title}`,
      body,
      source_kind: "system",
      source_ref: sourceRef,
      payload: { task_item_id: item.id },
    });

    await updateEntity({
      id: item.id,
      body: { last_notified_at: formatCstIso(new Date()) },
    });
    sent += 1;
  }

  return JSON.stringify({ ok: true, sent, scanned: search.results.length });
}
