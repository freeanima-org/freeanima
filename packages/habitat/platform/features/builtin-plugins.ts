import type { FeaturePlugin } from "./types.ts";
import { chatPlugin } from "@freeanima/features/chat/plugin";
import { habitatPlugin } from "@freeanima/features/habitat/plugin";
import { diaryPlugin } from "@freeanima/features/diary/plugin";
import { notePlugin } from "@freeanima/features/note/plugin";
import { calendarPlugin } from "@freeanima/features/calendar/plugin";
import { emailPlugin } from "@freeanima/features/email/plugin";
import { notificationPlugin } from "@freeanima/features/notification/plugin";
import { companionPlugin } from "@freeanima/features/companion/plugin";
import { codingPlugin } from "@freeanima/features/coding/plugin";
import { pomodoroPlugin } from "@freeanima/features/pomodoro/plugin";
import { shellQuickPlugin } from "@freeanima/features/shell-quick/plugin";
import { taskPlugin } from "@freeanima/features/task/plugin";
import { projectPlugin } from "@freeanima/features/project/plugin";
import { objectivePlugin } from "@freeanima/features/objective/plugin";
import { tagPlugin } from "@freeanima/features/tag/plugin";
import { subagentPlugin } from "@freeanima/features/subagent/plugin";
import { entityPlugin } from "@freeanima/features/entity/plugin";
import { vaultPlugin } from "@freeanima/features/vault/plugin";
import { bookmarkPlugin } from "@freeanima/features/bookmark/plugin";
import { contactPlugin } from "@freeanima/features/contact/plugin";
import { roomPlugin } from "@freeanima/features/room/plugin";

/** Habitat feature plugins registered at boot. */
export const builtinFeaturePlugins: FeaturePlugin[] = [
  chatPlugin,
  habitatPlugin,
  taskPlugin,
  projectPlugin,
  objectivePlugin,
  tagPlugin,
  subagentPlugin,
  entityPlugin,
  vaultPlugin,
  bookmarkPlugin,
  contactPlugin,
  roomPlugin,
  notificationPlugin,
  companionPlugin,
  codingPlugin,
  diaryPlugin,
  notePlugin,
  calendarPlugin,
  pomodoroPlugin,
  shellQuickPlugin,
  emailPlugin,
];
