import { mergeHubRouteBundles } from "@freeanima/shared/habitat-contract/route.ts";

import { chatHubRoutes } from "@freeanima/features/chat/habitat/routes/index.ts";
import { companionHubRoutes } from "@freeanima/features/companion/habitat/routes/index.ts";
import { consoleHubRoutes } from "@freeanima/features/habitat/habitat/routes/index.ts";
import { diaryHubRoutes } from "@freeanima/features/diary/habitat/routes/index.ts";
import { emailHubRoutes } from "@freeanima/features/email/habitat/routes/index.ts";
import { mcpHubRoutes } from "@freeanima/features/mcp/habitat/routes/index.ts";
import { notificationHubRoutes } from "@freeanima/features/notification/habitat/routes/index.ts";
import { pomodoroHubRoutes } from "@freeanima/features/pomodoro/habitat/routes/index.ts";
import { projectHubRoutes } from "@freeanima/features/project/habitat/routes/index.ts";
import { tagHubRoutes } from "@freeanima/features/tag/habitat/routes/index.ts";
import { taskHubRoutes } from "@freeanima/features/task/habitat/routes/index.ts";
import { vaultHubRoutes } from "@freeanima/features/vault/habitat/routes/index.ts";

import type { InferHubInputs, InferHubOutputs } from "./types.ts";
import { wsOnlyHubRoutes } from "./ws-only-routes.ts";

const featureRouteBundles = [
  chatHubRoutes,
  taskHubRoutes,
  projectHubRoutes,
  tagHubRoutes,
  vaultHubRoutes,
  emailHubRoutes,
  diaryHubRoutes,
  pomodoroHubRoutes,
  notificationHubRoutes,
  companionHubRoutes,
  wsOnlyHubRoutes,
  mcpHubRoutes,
  consoleHubRoutes,
] as const;

export const hubRouter = mergeHubRouteBundles(featureRouteBundles);

export type HubMethodInputs = InferHubInputs<typeof chatHubRoutes> &
  InferHubInputs<typeof taskHubRoutes> &
  InferHubInputs<typeof projectHubRoutes> &
  InferHubInputs<typeof tagHubRoutes> &
  InferHubInputs<typeof vaultHubRoutes> &
  InferHubInputs<typeof emailHubRoutes> &
  InferHubInputs<typeof diaryHubRoutes> &
  InferHubInputs<typeof pomodoroHubRoutes> &
  InferHubInputs<typeof notificationHubRoutes> &
  InferHubInputs<typeof companionHubRoutes> &
  InferHubInputs<typeof wsOnlyHubRoutes> &
  InferHubInputs<typeof mcpHubRoutes> &
  InferHubInputs<typeof consoleHubRoutes>;

export type HubMethodOutputs = InferHubOutputs<typeof chatHubRoutes> &
  InferHubOutputs<typeof taskHubRoutes> &
  InferHubOutputs<typeof projectHubRoutes> &
  InferHubOutputs<typeof tagHubRoutes> &
  InferHubOutputs<typeof vaultHubRoutes> &
  InferHubOutputs<typeof emailHubRoutes> &
  InferHubOutputs<typeof diaryHubRoutes> &
  InferHubOutputs<typeof pomodoroHubRoutes> &
  InferHubOutputs<typeof notificationHubRoutes> &
  InferHubOutputs<typeof companionHubRoutes> &
  InferHubOutputs<typeof wsOnlyHubRoutes> &
  InferHubOutputs<typeof mcpHubRoutes> &
  InferHubOutputs<typeof consoleHubRoutes>;

export type HubMethod = keyof HubMethodInputs & string;

export type { InferHubInputs, InferHubOutputs } from "./types.ts";
