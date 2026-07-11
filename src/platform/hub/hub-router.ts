import { mergeHubRouteBundles } from "@freeanima/shared/hub-contract/route.ts";

import { chatHubRoutes } from "@freeanima/features/chat/hub/routes/index.ts";
import { companionHubRoutes } from "@freeanima/features/companion/hub/routes/index.ts";
import { consoleHubRoutes } from "@freeanima/features/console/hub/routes/index.ts";
import { diaryHubRoutes } from "@freeanima/features/diary/hub/routes/index.ts";
import { dreamHubRoutes } from "@freeanima/features/dream/hub/routes/index.ts";
import { emailHubRoutes } from "@freeanima/features/email/hub/routes/index.ts";
import { mcpHubRoutes } from "@freeanima/features/mcp/hub/routes/index.ts";
import { notificationHubRoutes } from "@freeanima/features/notification/hub/routes/index.ts";
import { pomodoroHubRoutes } from "@freeanima/features/pomodoro/hub/routes/index.ts";
import { projectHubRoutes } from "@freeanima/features/project/hub/routes/index.ts";
import { taskHubRoutes } from "@freeanima/features/task/hub/routes/index.ts";
import { vaultHubRoutes } from "@freeanima/features/vault/hub/routes/index.ts";

import { defsOnlyBundle } from "./types.ts";
import { wsOnlyMethodDefs } from "@freeanima/shared/hub-contract/registry/ws-only.ts";

/** ws-only method 定义（handler 仍在 ws-server，见 ws-only-routes.ts） */
export const wsOnlyHubRoutes = defsOnlyBundle(wsOnlyMethodDefs);

export const hubRouter = mergeHubRouteBundles([
  chatHubRoutes,
  taskHubRoutes,
  projectHubRoutes,
  vaultHubRoutes,
  emailHubRoutes,
  diaryHubRoutes,
  dreamHubRoutes,
  pomodoroHubRoutes,
  notificationHubRoutes,
  companionHubRoutes,
  wsOnlyHubRoutes,
  mcpHubRoutes,
  consoleHubRoutes,
]);

export type HubMethod = keyof typeof hubRouter.defs & string;

export type { InferHubInputs, InferHubOutputs } from "./types.ts";
export type HubMethodInputs = import("./types.ts").InferHubInputs<typeof hubRouter>;
export type HubMethodOutputs = import("./types.ts").InferHubOutputs<typeof hubRouter>;
