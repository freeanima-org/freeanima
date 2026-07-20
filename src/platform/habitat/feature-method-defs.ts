import { chatMethodDefs } from "@freeanima/features/chat/habitat/method-defs.ts";
import { companionMethodDefs } from "@freeanima/features/companion/habitat/method-defs.ts";
import { diaryMethodDefs } from "@freeanima/features/diary/habitat/method-defs.ts";
import { emailMethodDefs } from "@freeanima/features/email/habitat/method-defs.ts";
import { mcpMethodDefs } from "@freeanima/features/mcp/habitat/method-defs.ts";
import { notificationMethodDefs } from "@freeanima/features/notification/habitat/method-defs.ts";
import { pomodoroMethodDefs } from "@freeanima/features/pomodoro/habitat/method-defs.ts";
import { projectMethodDefs } from "@freeanima/features/project/habitat/method-defs.ts";
import { tagMethodDefs } from "@freeanima/features/tag/habitat/method-defs.ts";
import { taskMethodDefs } from "@freeanima/features/task/habitat/method-defs.ts";
import { vaultMethodDefs } from "@freeanima/features/vault/habitat/method-defs.ts";

/** 聚合各 feature hub/method-defs.ts（浏览器 client registry 安装用） */
export const FEATURE_METHOD_DEFS = {
  ...chatMethodDefs,
  ...taskMethodDefs,
  ...projectMethodDefs,
  ...tagMethodDefs,
  ...vaultMethodDefs,
  ...emailMethodDefs,
  ...diaryMethodDefs,
  ...pomodoroMethodDefs,
  ...notificationMethodDefs,
  ...companionMethodDefs,
  ...mcpMethodDefs,
} as const;
