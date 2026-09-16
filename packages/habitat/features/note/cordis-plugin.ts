import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { noteHabitatRoutes } from "./habitat/routes/index.ts";

/** note feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "note",
  routes: noteHabitatRoutes,
});
