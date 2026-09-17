import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { companionHabitatRoutes } from "./habitat/routes/index.ts";

/** companion feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "companion",
  routes: companionHabitatRoutes,
});
