/** Product feature Habitat RPC frame schemas (bundled shell — not satellite attach). */
export * from "../frames/conversation.ts";
export * from "../frames/message.ts";
export * from "../frames/task.ts";
export * from "../frames/tag.ts";
export * from "../frames/subagent.ts";
export * from "../frames/entity.ts";
export * from "../frames/vault.ts";
export * from "../frames/diary.ts";
export * from "../frames/note.ts";
export * from "../frames/calendar.ts";
export * from "../frames/pomodoro.ts";
export * from "../frames/shell-quick.ts";
export * from "../frames/email.ts";
export * from "../frames/notification.ts";
export * from "../frames/companion.ts";
export * from "../frames/coding.ts";
export * from "../frames/bookmark.ts";
export * from "../frames/contact.ts";
export * from "../frames/room.ts";

/**
 * Feature Habitat RPC method defs —— **契约 SSOT**。
 *
 * 各特性服务端（`features/<slug>/habitat/routes`）与浏览器 client registry
 * 消费同一份定义，因此它们属于契约层而不是服务端特性包。
 */
export { bookmarkMethodDefs } from "./methods/bookmark.ts";
export { calendarMethodDefs } from "./methods/calendar.ts";
export { chatMethodDefs } from "./methods/chat.ts";
export { codingMethodDefs } from "./methods/coding.ts";
export { companionMethodDefs } from "./methods/companion.ts";
export { contactMethodDefs } from "./methods/contact.ts";
export { diaryMethodDefs } from "./methods/diary.ts";
export { emailMethodDefs } from "./methods/email.ts";
export { entityMethodDefs } from "./methods/entity.ts";
export { federationMethodDefs } from "./methods/federation.ts";
export { habitMethodDefs } from "./methods/habit.ts";
export { healthMethodDefs } from "./methods/health.ts";
export { mcpMethodDefs } from "./methods/mcp.ts";
export { noteMethodDefs } from "./methods/note.ts";
export { notificationMethodDefs } from "./methods/notification.ts";
export { objectStorageMethodDefs } from "./methods/object-storage.ts";
export { objectiveMethodDefs } from "./methods/objective.ts";
export { pomodoroMethodDefs } from "./methods/pomodoro.ts";
export { projectMethodDefs } from "./methods/project.ts";
export { roomMethodDefs } from "./methods/room.ts";
export { shellQuickMethodDefs } from "./methods/shell-quick.ts";
export { subagentMethodDefs } from "./methods/subagent.ts";
export { tagMethodDefs } from "./methods/tag.ts";
export { taskMethodDefs } from "./methods/task.ts";
export { vaultMethodDefs } from "./methods/vault.ts";

import { bookmarkMethodDefs } from "./methods/bookmark.ts";
import { calendarMethodDefs } from "./methods/calendar.ts";
import { chatMethodDefs } from "./methods/chat.ts";
import { codingMethodDefs } from "./methods/coding.ts";
import { companionMethodDefs } from "./methods/companion.ts";
import { contactMethodDefs } from "./methods/contact.ts";
import { diaryMethodDefs } from "./methods/diary.ts";
import { emailMethodDefs } from "./methods/email.ts";
import { entityMethodDefs } from "./methods/entity.ts";
import { federationMethodDefs } from "./methods/federation.ts";
import { habitMethodDefs } from "./methods/habit.ts";
import { healthMethodDefs } from "./methods/health.ts";
import { mcpMethodDefs } from "./methods/mcp.ts";
import { noteMethodDefs } from "./methods/note.ts";
import { notificationMethodDefs } from "./methods/notification.ts";
import { objectStorageMethodDefs } from "./methods/object-storage.ts";
import { objectiveMethodDefs } from "./methods/objective.ts";
import { pomodoroMethodDefs } from "./methods/pomodoro.ts";
import { projectMethodDefs } from "./methods/project.ts";
import { roomMethodDefs } from "./methods/room.ts";
import { shellQuickMethodDefs } from "./methods/shell-quick.ts";
import { subagentMethodDefs } from "./methods/subagent.ts";
import { tagMethodDefs } from "./methods/tag.ts";
import { taskMethodDefs } from "./methods/task.ts";
import { vaultMethodDefs } from "./methods/vault.ts";

/** 聚合各 feature method-defs（浏览器 client registry；无 handler）。 */
export const FEATURE_METHOD_DEFS = {
  ...chatMethodDefs,
  ...codingMethodDefs,
  ...taskMethodDefs,
  ...projectMethodDefs,
  ...objectiveMethodDefs,
  ...habitMethodDefs,
  ...tagMethodDefs,
  ...subagentMethodDefs,
  ...entityMethodDefs,
  ...vaultMethodDefs,
  ...bookmarkMethodDefs,
  ...healthMethodDefs,
  ...contactMethodDefs,
  ...roomMethodDefs,
  ...federationMethodDefs,
  ...emailMethodDefs,
  ...diaryMethodDefs,
  ...noteMethodDefs,
  ...calendarMethodDefs,
  ...pomodoroMethodDefs,
  ...shellQuickMethodDefs,
  ...notificationMethodDefs,
  ...companionMethodDefs,
  ...objectStorageMethodDefs,
  ...mcpMethodDefs,
} as const;
