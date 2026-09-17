import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { pomodoroHabitatRoutes } from "./habitat/routes/index.ts";

/** pomodoro feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "pomodoro",
  routes: pomodoroHabitatRoutes,
});
