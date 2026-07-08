import type { FeaturePlugin } from "./types.ts";
import { chatPlugin } from "@freeanima/feature-chat/plugin";
import { consolePlugin } from "@freeanima/feature-console/plugin";
import { diaryPlugin } from "@freeanima/feature-diary/plugin";
import { dreamPlugin } from "@freeanima/feature-dream/plugin";
import { emailPlugin } from "@freeanima/feature-email/plugin";
import { notificationPlugin } from "@freeanima/feature-notification/plugin";
import { companionPlugin } from "@freeanima/feature-companion/plugin";
import { taskPlugin } from "@freeanima/feature-task/plugin";
import { vaultPlugin } from "@freeanima/feature-vault/plugin";

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
  emailPlugin,
];
