import { mergeHabitatRouteBundles } from "@freeanima/shared/habitat-contract/route.ts";

import { chatHabitatRoutes } from "@freeanima/features/chat/habitat/routes/index.ts";
import { companionHabitatRoutes } from "@freeanima/features/companion/habitat/routes/index.ts";
import { codingHabitatRoutes } from "@freeanima/features/coding/habitat/routes/index.ts";
import { habitatCoreRoutes } from "@freeanima/features/habitat/habitat/routes/index.ts";
import { diaryHabitatRoutes } from "@freeanima/features/diary/habitat/routes/index.ts";
import { noteHabitatRoutes } from "@freeanima/features/note/habitat/routes/index.ts";
import { calendarHabitatRoutes } from "@freeanima/features/calendar/habitat/routes/index.ts";
import { emailHabitatRoutes } from "@freeanima/features/email/habitat/routes/index.ts";
import { mcpHabitatRoutes } from "@freeanima/features/mcp/habitat/routes/index.ts";
import { notificationHabitatRoutes } from "@freeanima/features/notification/habitat/routes/index.ts";
import { objectStorageHabitatRoutes } from "@freeanima/features/object-storage/habitat/routes/index.ts";
import { pomodoroHabitatRoutes } from "@freeanima/features/pomodoro/habitat/routes/index.ts";
import { shellQuickHabitatRoutes } from "@freeanima/features/shell-quick/habitat/routes/index.ts";
import { projectHabitatRoutes } from "@freeanima/features/project/habitat/routes/index.ts";
import { objectiveHabitatRoutes } from "@freeanima/features/objective/habitat/routes/index.ts";
import { tagHabitatRoutes } from "@freeanima/features/tag/habitat/routes/index.ts";
import { subagentHabitatRoutes } from "@freeanima/features/subagent/habitat/routes/index.ts";
import { entityHabitatRoutes } from "@freeanima/features/entity/habitat/routes/index.ts";
import { taskHabitatRoutes } from "@freeanima/features/task/habitat/routes/index.ts";
import { vaultHabitatRoutes } from "@freeanima/features/vault/habitat/routes/index.ts";
import { bookmarkHabitatRoutes } from "@freeanima/features/bookmark/habitat/routes/index.ts";
import { contactHabitatRoutes } from "@freeanima/features/contact/habitat/routes/index.ts";

import type { InferHabitatInputs, InferHabitatOutputs } from "./types.ts";
import { wsOnlyHabitatRoutes } from "./ws-only-routes.ts";

const featureRouteBundles = [
  chatHabitatRoutes,
  taskHabitatRoutes,
  projectHabitatRoutes,
  objectiveHabitatRoutes,
  tagHabitatRoutes,
  subagentHabitatRoutes,
  entityHabitatRoutes,
  vaultHabitatRoutes,
  bookmarkHabitatRoutes,
  contactHabitatRoutes,
  emailHabitatRoutes,
  diaryHabitatRoutes,
  noteHabitatRoutes,
  calendarHabitatRoutes,
  pomodoroHabitatRoutes,
  shellQuickHabitatRoutes,
  notificationHabitatRoutes,
  companionHabitatRoutes,
  codingHabitatRoutes,
  objectStorageHabitatRoutes,
  wsOnlyHabitatRoutes,
  mcpHabitatRoutes,
  habitatCoreRoutes,
] as const;

export const habitatRouter = mergeHabitatRouteBundles(featureRouteBundles);
export type HabitatMethodInputs = InferHabitatInputs<typeof chatHabitatRoutes> &
  InferHabitatInputs<typeof taskHabitatRoutes> &
  InferHabitatInputs<typeof projectHabitatRoutes> &
  InferHabitatInputs<typeof objectiveHabitatRoutes> &
  InferHabitatInputs<typeof tagHabitatRoutes> &
  InferHabitatInputs<typeof subagentHabitatRoutes> &
  InferHabitatInputs<typeof entityHabitatRoutes> &
  InferHabitatInputs<typeof vaultHabitatRoutes> &
  InferHabitatInputs<typeof bookmarkHabitatRoutes> &
  InferHabitatInputs<typeof contactHabitatRoutes> &
  InferHabitatInputs<typeof emailHabitatRoutes> &
  InferHabitatInputs<typeof diaryHabitatRoutes> &
  InferHabitatInputs<typeof noteHabitatRoutes> &
  InferHabitatInputs<typeof calendarHabitatRoutes> &
  InferHabitatInputs<typeof pomodoroHabitatRoutes> &
  InferHabitatInputs<typeof shellQuickHabitatRoutes> &
  InferHabitatInputs<typeof notificationHabitatRoutes> &
  InferHabitatInputs<typeof companionHabitatRoutes> &
  InferHabitatInputs<typeof codingHabitatRoutes> &
  InferHabitatInputs<typeof objectStorageHabitatRoutes> &
  InferHabitatInputs<typeof wsOnlyHabitatRoutes> &
  InferHabitatInputs<typeof mcpHabitatRoutes> &
  InferHabitatInputs<typeof habitatCoreRoutes>;

export type HabitatMethodOutputs = InferHabitatOutputs<typeof chatHabitatRoutes> &
  InferHabitatOutputs<typeof taskHabitatRoutes> &
  InferHabitatOutputs<typeof projectHabitatRoutes> &
  InferHabitatOutputs<typeof objectiveHabitatRoutes> &
  InferHabitatOutputs<typeof tagHabitatRoutes> &
  InferHabitatOutputs<typeof subagentHabitatRoutes> &
  InferHabitatOutputs<typeof entityHabitatRoutes> &
  InferHabitatOutputs<typeof vaultHabitatRoutes> &
  InferHabitatOutputs<typeof bookmarkHabitatRoutes> &
  InferHabitatOutputs<typeof contactHabitatRoutes> &
  InferHabitatOutputs<typeof emailHabitatRoutes> &
  InferHabitatOutputs<typeof diaryHabitatRoutes> &
  InferHabitatOutputs<typeof noteHabitatRoutes> &
  InferHabitatOutputs<typeof calendarHabitatRoutes> &
  InferHabitatOutputs<typeof pomodoroHabitatRoutes> &
  InferHabitatOutputs<typeof shellQuickHabitatRoutes> &
  InferHabitatOutputs<typeof notificationHabitatRoutes> &
  InferHabitatOutputs<typeof companionHabitatRoutes> &
  InferHabitatOutputs<typeof codingHabitatRoutes> &
  InferHabitatOutputs<typeof objectStorageHabitatRoutes> &
  InferHabitatOutputs<typeof wsOnlyHabitatRoutes> &
  InferHabitatOutputs<typeof mcpHabitatRoutes> &
  InferHabitatOutputs<typeof habitatCoreRoutes>;

export type HabitatMethod = Extract<keyof HabitatMethodInputs, string>;

export type { InferHabitatInputs, InferHabitatOutputs } from "./types.ts";
