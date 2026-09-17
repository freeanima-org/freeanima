import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { bookmarkHabitatRoutes } from "./habitat/routes/index.ts";

/** bookmark feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "bookmark",
  routes: bookmarkHabitatRoutes,
});
