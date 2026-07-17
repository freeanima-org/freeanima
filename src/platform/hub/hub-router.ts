import { mergeHubRouteBundles } from "@freeanima/shared/hub-contract/route.ts";

import { chatHubRoutes } from "@freeanima/features/chat/hub/routes/index.ts";
import { companionHubRoutes } from "@freeanima/features/companion/hub/routes/index.ts";
import { consoleHubRoutes } from "@freeanima/features/console/hub/routes/index.ts";
import { diaryHubRoutes } from "@freeanima/features/diary/hub/routes/index.ts";
import { emailHubRoutes } from "@freeanima/features/email/hub/routes/index.ts";
import { mcpHubRoutes } from "@freeanima/features/mcp/hub/routes/index.ts";
import { notificationHubRoutes } from "@freeanima/features/notification/hub/routes/index.ts";
import { pomodoroHubRoutes } from "@freeanima/features/pomodoro/hub/routes/index.ts";
import { projectHubRoutes } from "@freeanima/features/project/hub/routes/index.ts";
import { taskHubRoutes } from "@freeanima/features/task/hub/routes/index.ts";
import { vaultHubRoutes } from "@freeanima/features/vault/hub/routes/index.ts";

import type { InferHubInputs, InferHubOutputs } from "./types.ts";
import { wsOnlyHubRoutes } from "./ws-only-routes.ts";

const featureRouteBundles = [
  chatHubRoutes,
  taskHubRoutes,
  projectHubRoutes,
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
