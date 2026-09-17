import { createFeaturePlugin } from "@freeanima/server/features/plugin.ts";

import { habitHabitatRoutes } from "./habitat/routes/index.ts";

/** habit feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "habit",
  routes: habitHabitatRoutes,
});
