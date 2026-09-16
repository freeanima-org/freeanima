import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { federationHabitatRoutes } from "./habitat/routes/index.ts";

/** federation feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "federation",
  routes: federationHabitatRoutes,
});
