import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { taskHabitatRoutes } from "./habitat/routes/index.ts";

/** task feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "task",
  routes: taskHabitatRoutes,
});
