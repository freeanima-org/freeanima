import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { entityHabitatRoutes } from "./habitat/routes/index.ts";

/** entity feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "entity",
  routes: entityHabitatRoutes,
});
