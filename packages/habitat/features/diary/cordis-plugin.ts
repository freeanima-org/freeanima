import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { diaryHabitatRoutes } from "./habitat/routes/index.ts";

/** diary feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "diary",
  routes: diaryHabitatRoutes,
});
