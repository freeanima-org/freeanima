import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { contactHabitatRoutes } from "./habitat/routes/index.ts";

/** contact feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "contact",
  routes: contactHabitatRoutes,
});
