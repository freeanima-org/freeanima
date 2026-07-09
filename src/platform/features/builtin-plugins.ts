import type { FeaturePlugin } from "./types.ts";
import { chatPlugin } from "@freeanima/features/chat/plugin";
import { consolePlugin } from "@freeanima/features/console/plugin";
import { diaryPlugin } from "@freeanima/features/diary/plugin";
import { dreamPlugin } from "@freeanima/features/dream/plugin";
import { emailPlugin } from "@freeanima/features/email/plugin";
import { notificationPlugin } from "@freeanima/features/notification/plugin";
import { companionPlugin } from "@freeanima/features/companion/plugin";
import { pomodoroPlugin } from "@freeanima/features/pomodoro/plugin";
import { taskPlugin } from "@freeanima/features/task/plugin";
import { vaultPlugin } from "@freeanima/features/vault/plugin";

/** Hub feature plugins registered at boot. */
export const builtinFeaturePlugins: FeaturePlugin[] = [
  chatPlugin,
  consolePlugin,
  taskPlugin,
  vaultPlugin,
  notificationPlugin,
  companionPlugin,
  diaryPlugin,
  dreamPlugin,
  pomodoroPlugin,
  emailPlugin,
];
