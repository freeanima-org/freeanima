/** 实现已下沉 @freeanima/capabilities/ports/task-advance-reminders（服务端 emit / 特性 watch 共用）。 */
export {
  emitTaskAdvanceReminder,
  resetTaskAdvanceReminderWatchersForTest,
  watchTaskAdvanceReminder,
  type TaskAdvanceReminderPayload,
} from "@freeanima/capabilities/ports/task-advance-reminders.ts";
