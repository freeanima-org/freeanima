import { chatMethodDefs } from "@freeanima/features/chat/hub/method-defs.ts";
import { companionMethodDefs } from "@freeanima/features/companion/hub/method-defs.ts";
import { diaryMethodDefs } from "@freeanima/features/diary/hub/method-defs.ts";
import { emailMethodDefs } from "@freeanima/features/email/hub/method-defs.ts";
import { mcpMethodDefs } from "@freeanima/features/mcp/hub/method-defs.ts";
import { notificationMethodDefs } from "@freeanima/features/notification/hub/method-defs.ts";
import { pomodoroMethodDefs } from "@freeanima/features/pomodoro/hub/method-defs.ts";
import { projectMethodDefs } from "@freeanima/features/project/hub/method-defs.ts";
import { taskMethodDefs } from "@freeanima/features/task/hub/method-defs.ts";
import { vaultMethodDefs } from "@freeanima/features/vault/hub/method-defs.ts";

/** 聚合各 feature hub/method-defs.ts（浏览器 client registry 安装用） */
export const FEATURE_METHOD_DEFS = {
  ...chatMethodDefs,
  ...taskMethodDefs,
  ...projectMethodDefs,
  ...vaultMethodDefs,
  ...emailMethodDefs,
  ...diaryMethodDefs,
  ...pomodoroMethodDefs,
  ...notificationMethodDefs,
  ...companionMethodDefs,
  ...mcpMethodDefs,
} as const;
