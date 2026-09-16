import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { roomHabitatRoutes } from "./habitat/routes/index.ts";

/** room feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "room",
  routes: roomHabitatRoutes,
});
