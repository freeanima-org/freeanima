import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { notificationHabitatRoutes } from "./habitat/routes/index.ts";

/** notification feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "notification",
  routes: notificationHabitatRoutes,
});
