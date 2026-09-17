import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { tagHabitatRoutes } from "./habitat/routes/index.ts";

/** tag feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "tag",
  routes: tagHabitatRoutes,
});
