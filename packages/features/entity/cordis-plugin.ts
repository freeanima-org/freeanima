import { createFeaturePlugin } from "@freeanima/server/features/plugin.ts";

import { entityHabitatRoutes } from "./habitat/routes/index.ts";

/** entity feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "entity",
  routes: entityHabitatRoutes,
});
