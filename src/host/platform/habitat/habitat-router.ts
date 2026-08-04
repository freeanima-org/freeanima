import { mergeHabitatRouteBundles } from "@freeanima/shared/habitat-contract/route.ts";

import { chatHabitatRoutes } from "@freeanima/features/chat/habitat/routes/index.ts";
import { companionHabitatRoutes } from "@freeanima/features/companion/habitat/routes/index.ts";
import { codingHabitatRoutes } from "@freeanima/features/coding/habitat/routes/index.ts";
import { habitatCoreRoutes } from "@freeanima/features/habitat/habitat/routes/index.ts";
import { diaryHabitatRoutes } from "@freeanima/features/diary/habitat/routes/index.ts";
import { calendarHabitatRoutes } from "@freeanima/features/calendar/habitat/routes/index.ts";
import { emailHabitatRoutes } from "@freeanima/features/email/habitat/routes/index.ts";
import { mcpHabitatRoutes } from "@freeanima/features/mcp/habitat/routes/index.ts";
import { notificationHabitatRoutes } from "@freeanima/features/notification/habitat/routes/index.ts";
import { objectStorageHabitatRoutes } from "@freeanima/features/object-storage/habitat/routes/index.ts";
import { pomodoroHabitatRoutes } from "@freeanima/features/pomodoro/habitat/routes/index.ts";
import { projectHabitatRoutes } from "@freeanima/features/project/habitat/routes/index.ts";
import { tagHabitatRoutes } from "@freeanima/features/tag/habitat/routes/index.ts";
import { subagentHabitatRoutes } from "@freeanima/features/subagent/habitat/routes/index.ts";
import { entityHabitatRoutes } from "@freeanima/features/entity/habitat/routes/index.ts";
import { taskHabitatRoutes } from "@freeanima/features/task/habitat/routes/index.ts";
import { vaultHabitatRoutes } from "@freeanima/features/vault/habitat/routes/index.ts";

import type { InferHabitatInputs, InferHabitatOutputs } from "./types.ts";
import { wsOnlyHabitatRoutes } from "./ws-only-routes.ts";

const featureRouteBundles = [
  chatHabitatRoutes,
  taskHabitatRoutes,
  projectHabitatRoutes,
  tagHabitatRoutes,
  subagentHabitatRoutes,
  entityHabitatRoutes,
  vaultHabitatRoutes,
  emailHabitatRoutes,
  diaryHabitatRoutes,
  calendarHabitatRoutes,
  pomodoroHabitatRoutes,
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
  InferHabitatInputs<typeof tagHabitatRoutes> &
  InferHabitatInputs<typeof subagentHabitatRoutes> &
  InferHabitatInputs<typeof entityHabitatRoutes> &
  InferHabitatInputs<typeof vaultHabitatRoutes> &
  InferHabitatInputs<typeof emailHabitatRoutes> &
  InferHabitatInputs<typeof diaryHabitatRoutes> &
  InferHabitatInputs<typeof calendarHabitatRoutes> &
  InferHabitatInputs<typeof pomodoroHabitatRoutes> &
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
  InferHabitatOutputs<typeof tagHabitatRoutes> &
  InferHabitatOutputs<typeof subagentHabitatRoutes> &
  InferHabitatOutputs<typeof entityHabitatRoutes> &
  InferHabitatOutputs<typeof vaultHabitatRoutes> &
  InferHabitatOutputs<typeof emailHabitatRoutes> &
  InferHabitatOutputs<typeof diaryHabitatRoutes> &
  InferHabitatOutputs<typeof calendarHabitatRoutes> &
  InferHabitatOutputs<typeof pomodoroHabitatRoutes> &
  InferHabitatOutputs<typeof notificationHabitatRoutes> &
  InferHabitatOutputs<typeof companionHabitatRoutes> &
  InferHabitatOutputs<typeof codingHabitatRoutes> &
  InferHabitatOutputs<typeof objectStorageHabitatRoutes> &
  InferHabitatOutputs<typeof wsOnlyHabitatRoutes> &
  InferHabitatOutputs<typeof mcpHabitatRoutes> &
  InferHabitatOutputs<typeof habitatCoreRoutes>;

export type HabitatMethod = keyof HabitatMethodInputs & string;

export type { InferHabitatInputs, InferHabitatOutputs } from "./types.ts";
