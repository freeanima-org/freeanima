import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { codingHabitatRoutes } from "./habitat/routes/index.ts";

/** coding feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "coding",
  routes: codingHabitatRoutes,
});
