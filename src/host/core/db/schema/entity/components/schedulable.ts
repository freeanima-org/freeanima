import { z } from "zod";

import { formatCstIso } from "@freeanima/host/core/util";

/** 提前提醒条目（非 due）；到点只打本机 Alert，不写 Inbox */
export const schedulableReminderEntrySchema = z.object({
  at: z.string().min(1),
  /** 该条目上次成功 Alert 的时间；系统维护 */
  last_notified_at: z.string().nullable().optional(),
});

export type SchedulableReminderEntry = z.infer<typeof schedulableReminderEntrySchema>;

/** 抽象 schedulable — 仅 Zod 层，不写入 components 数组 */
export const schedulableBodySchema = z.object({
  due_at: z.string().nullable().optional(),
  /**
   * 兼容单字段提醒：与 `reminders` 最早一项同步。
   * 新写入优先写 `reminders`；读写层可互相归一。
   */
  remind_at: z.string().nullable().optional(),
  /** 多提醒（提前响铃）；due 仍用顶层 `due_at` + `last_notified_at` */
  reminders: z.array(schedulableReminderEntrySchema).optional(),
  /** due Inbox 上次成功通知时间（ISO8601）；系统维护，非用户字段 */
  last_notified_at: z.string().nullable().optional(),
});

export type SchedulableBody = z.infer<typeof schedulableBodySchema>;

/** 将 remind_at / reminders 归一为稳定形状（按 at 升序） */
export function normalizeSchedulableReminders(input: {
  remind_at?: string | null | undefined;
  reminders?: SchedulableReminderEntry[] | null | undefined;
}): { remind_at: string | null; reminders: SchedulableReminderEntry[] } {
  const fromArray = (input.reminders ?? [])
    .filter((r) => typeof r.at === "string" && r.at.length > 0)
    .map((r) => ({
      at: r.at,
      ...(r.last_notified_at !== undefined ? { last_notified_at: r.last_notified_at } : {}),
    }))
    .toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));

  if (fromArray.length > 0) {
    return { remind_at: fromArray[0]?.at ?? null, reminders: fromArray };
  }

  const single = input.remind_at != null && input.remind_at !== "" ? input.remind_at : null;
  if (single) {
    return { remind_at: single, reminders: [{ at: single }] };
  }
  return { remind_at: null, reminders: [] };
}

/** 滚期：保持每条提醒相对 due 的偏移 */
export function shiftSchedulableReminders(
  prevDueAt: string | null | undefined,
  nextDueAt: string,
  reminders: SchedulableReminderEntry[] | null | undefined,
  legacyRemindAt?: string | null | undefined,
): { remind_at: string | null; reminders: SchedulableReminderEntry[] } {
  const prevDueMs = prevDueAt ? Date.parse(prevDueAt) : NaN;
  const nextDueMs = Date.parse(nextDueAt);
  if (!Number.isFinite(prevDueMs) || !Number.isFinite(nextDueMs)) {
    return { remind_at: null, reminders: [] };
  }
  const delta = nextDueMs - prevDueMs;
  const src = normalizeSchedulableReminders({
    reminders: reminders ?? [],
    remind_at: legacyRemindAt,
  }).reminders;
  if (src.length === 0) {
    return { remind_at: null, reminders: [] };
  }
  const shifted = src.map((r) => {
    const atMs = Date.parse(r.at);
    if (!Number.isFinite(atMs)) return { at: r.at, last_notified_at: null as string | null };
    return {
      at: formatCstIso(new Date(atMs + delta)),
      last_notified_at: null as string | null,
    };
  });
  return normalizeSchedulableReminders({ reminders: shifted });
}
