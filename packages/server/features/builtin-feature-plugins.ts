import bookmarkPlugin from "@freeanima/features/bookmark/cordis-plugin.ts";
import calendarPlugin from "@freeanima/features/calendar/cordis-plugin.ts";
import chatPlugin from "@freeanima/features/chat/cordis-plugin.ts";
import codingPlugin from "@freeanima/features/coding/cordis-plugin.ts";
import companionPlugin from "@freeanima/features/companion/cordis-plugin.ts";
import contactPlugin from "@freeanima/features/contact/cordis-plugin.ts";
import diaryPlugin from "@freeanima/features/diary/cordis-plugin.ts";
import emailPlugin from "@freeanima/features/email/cordis-plugin.ts";
import entityPlugin from "@freeanima/features/entity/cordis-plugin.ts";
import federationPlugin from "@freeanima/features/federation/cordis-plugin.ts";
import habitatPlugin from "@freeanima/features/habitat/cordis-plugin.ts";
import habitPlugin from "@freeanima/features/habit/cordis-plugin.ts";
import healthPlugin from "@freeanima/features/health/cordis-plugin.ts";
import mcpPlugin from "@freeanima/features/mcp/cordis-plugin.ts";
import notePlugin from "@freeanima/features/note/cordis-plugin.ts";
import notificationPlugin from "@freeanima/features/notification/cordis-plugin.ts";
import objectivePlugin from "@freeanima/features/objective/cordis-plugin.ts";
import objectStoragePlugin from "@freeanima/features/object-storage/cordis-plugin.ts";
import pomodoroPlugin from "@freeanima/features/pomodoro/cordis-plugin.ts";
import projectPlugin from "@freeanima/features/project/cordis-plugin.ts";
import roomPlugin from "@freeanima/features/room/cordis-plugin.ts";
import shellQuickPlugin from "@freeanima/features/shell-quick/cordis-plugin.ts";
import subagentPlugin from "@freeanima/features/subagent/cordis-plugin.ts";
import tagPlugin from "@freeanima/features/tag/cordis-plugin.ts";
import taskPlugin from "@freeanima/features/task/cordis-plugin.ts";
import vaultPlugin from "@freeanima/features/vault/cordis-plugin.ts";

import wsOnlyPlugin from "./providers/ws-only.ts";
import type { FeaturePluginModule } from "@freeanima/core/features/plugin.ts";

/**
 * Feature plugins mounted at boot: one per Habitat route bundle, plus the
 * platform-level WS-only routes. Covers every method in `habitatRouter`.
 */
export const builtinFeaturePlugins: readonly FeaturePluginModule[] = [
  chatPlugin,
  habitatPlugin,
  taskPlugin,
  projectPlugin,
  objectivePlugin,
  habitPlugin,
  tagPlugin,
  subagentPlugin,
  entityPlugin,
  vaultPlugin,
  bookmarkPlugin,
  healthPlugin,
  contactPlugin,
  federationPlugin,
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
  mcpPlugin,
  objectStoragePlugin,
  wsOnlyPlugin,
];
