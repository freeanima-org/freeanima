import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { habitatCoreRoutes } from "./habitat/routes/index.ts";

/** habitat feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "habitat",
  routes: habitatCoreRoutes,
});
