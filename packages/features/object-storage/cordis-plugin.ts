import { createFeaturePlugin } from "@freeanima/server/features/plugin.ts";

import { objectStorageHabitatRoutes } from "./habitat/routes/index.ts";

/** object-storage feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "object-storage",
  routes: objectStorageHabitatRoutes,
});
