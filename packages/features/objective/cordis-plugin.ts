import { createFeaturePlugin } from "@freeanima/server/features/plugin.ts";

import { objectiveHabitatRoutes } from "./habitat/routes/index.ts";

/** objective feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "objective",
  routes: objectiveHabitatRoutes,
});
