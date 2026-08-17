import { z } from "zod";

import { formatCstIso } from "@freeanima/habitat/core/util";

/** 提醒相对哪类时间锚点平移 / UI 预设 */
export const reminderAnchorSchema = z.enum(["start", "end", "due"]);
export type ReminderAnchor = z.infer<typeof reminderAnchorSchema>;

/** 提前提醒条目；到点只打本机 Alert，不写 Inbox（任务 due Inbox 另走 due_at） */
export const schedulableReminderEntrySchema = z.object({
  at: z.string().min(1),
  /** 缺省：迁移/旧数据按上下文补；新写入应显式带上 */
  anchor: reminderAnchorSchema.optional(),
  /** 该条目上次成功 Alert 的时间；系统维护 */
  last_notified_at: z.string().nullable().optional(),
});

export type SchedulableReminderEntry = z.infer<typeof schedulableReminderEntrySchema>;

/** 计划时间（单点：仅 start；时段：start+end） */
export const plannedTimeBodySchema = z.object({
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
});

export type PlannedTimeBody = z.infer<typeof plannedTimeBodySchema>;

/** 提醒字段（remind_at = reminders 最早一项镜像） */
export const reminderBodySchema = z.object({
  remind_at: z.string().nullable().optional(),
  reminders: z.array(schedulableReminderEntrySchema).optional(),
  /** due/事件 Inbox 上次成功通知时间；系统维护 */
  last_notified_at: z.string().nullable().optional(),
});

export type ReminderBody = z.infer<typeof reminderBodySchema>;

/**
 * 任务可调度体：计划 + 独立 deadline + 提醒。
 * @deprecated 名称保留兼容；新代码请组合 planned / reminder / due。
 */
export const schedulableBodySchema = plannedTimeBodySchema.merge(reminderBodySchema).extend({
  /** 截止（deadline）；与计划独立；Inbox「到期」仅看本字段 */
  due_at: z.string().nullable().optional(),
});

export type SchedulableBody = z.infer<typeof schedulableBodySchema>;

export function nonEmptyIso(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** 计划时钟：时段终点，否则单点开始 */
export function taskPlanClock(input: {
  start_at?: string | null | undefined;
  end_at?: string | null | undefined;
}): string | null {
  return nonEmptyIso(input.end_at) ?? nonEmptyIso(input.start_at);
}

export function hasTaskPlan(input: {
  start_at?: string | null | undefined;
  end_at?: string | null | undefined;
}): boolean {
  return taskPlanClock(input) != null;
}

export function hasTaskDeadline(input: { due_at?: string | null | undefined }): boolean {
  return nonEmptyIso(input.due_at) != null;
}

/** 有计划或截止 → 允许提醒；重复另需计划时钟 */
export function hasTaskScheduleTime(input: {
  start_at?: string | null | undefined;
  end_at?: string | null | undefined;
  due_at?: string | null | undefined;
}): boolean {
  return hasTaskPlan(input) || hasTaskDeadline(input);
}

/**
 * 读路径兼容：旧「start+due 当计划时段 / 仅 due 当计划点」→ 新模型。
 * 返回是否发生了重塑。
 */
export function reshapeLegacyTaskTimes(obj: Record<string, unknown>): boolean {
  const start = nonEmptyIso(obj.start_at);
  const end = nonEmptyIso(obj.end_at);
  const due = nonEmptyIso(obj.due_at);
  if (due == null) return false;
  // 已有 end_at：视为已迁移（due 可为真 deadline）
  if (end != null) return false;

  if (start != null) {
    // 旧区间：due 实为计划结束
    obj.end_at = due;
    obj.due_at = null;
    applyDefaultReminderAnchors(obj, "end");
    return true;
  }
  // 旧单点：due 实为计划点
  obj.start_at = due;
  obj.end_at = null;
  obj.due_at = null;
  applyDefaultReminderAnchors(obj, "start");
  return true;
}

function applyDefaultReminderAnchors(obj: Record<string, unknown>, anchor: ReminderAnchor): void {
  if (!Array.isArray(obj.reminders)) return;
  obj.reminders = obj.reminders.map((r) => {
    if (r == null || typeof r !== "object") return r;
    const entry = r as Record<string, unknown>;
    if (entry.anchor === "start" || entry.anchor === "end" || entry.anchor === "due") return r;
    return { ...entry, anchor };
  });
}

/** 将 remind_at / reminders 归一为稳定形状（按 at 升序）；保留 anchor */
export function normalizeSchedulableReminders(input: {
  remind_at?: string | null | undefined;
  reminders?: SchedulableReminderEntry[] | null | undefined;
  defaultAnchor?: ReminderAnchor | undefined;
}): { remind_at: string | null; reminders: SchedulableReminderEntry[] } {
  const fromArray = (input.reminders ?? [])
    .filter((r) => typeof r.at === "string" && r.at.length > 0)
    .map((r) => {
      const anchor =
        r.anchor === "start" || r.anchor === "end" || r.anchor === "due"
          ? r.anchor
          : input.defaultAnchor;
      return {
        at: r.at,
        ...(anchor !== undefined ? { anchor } : {}),
        ...(r.last_notified_at !== undefined ? { last_notified_at: r.last_notified_at } : {}),
      };
    })
    .toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));

  if (fromArray.length > 0) {
    return { remind_at: fromArray[0]?.at ?? null, reminders: fromArray };
  }

  const single = input.remind_at != null && input.remind_at !== "" ? input.remind_at : null;
  if (single) {
    return {
      remind_at: single,
      reminders: [
        {
          at: single,
          ...(input.defaultAnchor !== undefined ? { anchor: input.defaultAnchor } : {}),
        },
      ],
    };
  }
  return { remind_at: null, reminders: [] };
}

function shiftIsoByDelta(iso: string, deltaMs: number): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return formatCstIso(new Date(ms + deltaMs));
}

/** 滚期：按计划时钟 delta 平移 start/end */
export function shiftSchedulablePlannedRange(
  prevClock: string | null | undefined,
  nextClock: string,
  startAt: string | null | undefined,
  endAt: string | null | undefined,
): { start_at: string | null; end_at: string | null } {
  const prevMs = prevClock ? Date.parse(prevClock) : NaN;
  const nextMs = Date.parse(nextClock);
  if (!Number.isFinite(prevMs) || !Number.isFinite(nextMs)) {
    return {
      start_at: nonEmptyIso(startAt),
      end_at: nonEmptyIso(endAt),
    };
  }
  const delta = nextMs - prevMs;
  const start = nonEmptyIso(startAt);
  const end = nonEmptyIso(endAt);
  return {
    start_at: start != null ? (shiftIsoByDelta(start, delta) ?? start) : null,
    end_at: end != null ? (shiftIsoByDelta(end, delta) ?? end) : null,
  };
}

/** @deprecated 使用 {@link shiftSchedulablePlannedRange} */
export function shiftSchedulableStartAt(
  prevClock: string | null | undefined,
  nextClock: string,
  startAt: string | null | undefined,
): string | null {
  return shiftSchedulablePlannedRange(prevClock, nextClock, startAt, null).start_at;
}

/** 滚期：保持每条提醒相对时钟的偏移（整组同 delta） */
export function shiftSchedulableReminders(
  prevClock: string | null | undefined,
  nextClock: string,
  reminders: SchedulableReminderEntry[] | null | undefined,
  legacyRemindAt?: string | null,
): { remind_at: string | null; reminders: SchedulableReminderEntry[] } {
  const prevMs = prevClock ? Date.parse(prevClock) : NaN;
  const nextMs = Date.parse(nextClock);
  if (!Number.isFinite(prevMs) || !Number.isFinite(nextMs)) {
    return { remind_at: null, reminders: [] };
  }
  const delta = nextMs - prevMs;
  const src = normalizeSchedulableReminders({
    reminders: reminders ?? [],
    remind_at: legacyRemindAt,
  }).reminders;
  if (src.length === 0) {
    return { remind_at: null, reminders: [] };
  }
  const shifted = src.map((r) => {
    const nextAt = shiftIsoByDelta(r.at, delta);
    return {
      at: nextAt ?? r.at,
      ...(r.anchor !== undefined ? { anchor: r.anchor } : {}),
      last_notified_at: null as string | null,
    };
  });
  return normalizeSchedulableReminders({ reminders: shifted });
}

/** 滚期：平移独立 deadline */
export function shiftSchedulableDueAt(
  prevClock: string | null | undefined,
  nextClock: string,
  dueAt: string | null | undefined,
): string | null {
  const due = nonEmptyIso(dueAt);
  if (due == null) return null;
  const prevMs = prevClock ? Date.parse(prevClock) : NaN;
  const nextMs = Date.parse(nextClock);
  if (!Number.isFinite(prevMs) || !Number.isFinite(nextMs)) return due;
  return shiftIsoByDelta(due, nextMs - prevMs) ?? due;
}
