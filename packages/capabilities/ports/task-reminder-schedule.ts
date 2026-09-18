import { platformPorts } from "./service.ts";

/**
 * 任务提醒 sleep-until-next 调度（实现由 server 注入）。
 *
 * 能力/特性只表达意图（启动 / 停止 / mutation 后重算），不 import 组合根；
 * 未注入（未跑 boot 的单测）时静默跳过。
 */
export function startTaskReminderScheduler(): void {
  platformPorts().startTaskReminders?.();
}

export function stopTaskReminderScheduler(): void {
  platformPorts().stopTaskReminders?.();
}

export function rescheduleTaskReminderScheduler(): void {
  platformPorts().rescheduleTaskReminders?.();
}
