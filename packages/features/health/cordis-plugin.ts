import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { healthHabitatRoutes } from "./habitat/routes/index.ts";

/** health feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "health",
  routes: healthHabitatRoutes,
});
