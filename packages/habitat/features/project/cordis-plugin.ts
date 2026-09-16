import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { projectHabitatRoutes } from "./habitat/routes/index.ts";

/** project feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "project",
  routes: projectHabitatRoutes,
});
