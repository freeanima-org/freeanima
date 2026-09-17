import { createFeaturePlugin } from "@freeanima/server/features/plugin.ts";

import { emailHabitatRoutes } from "./habitat/routes/index.ts";

/** email feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "email",
  routes: emailHabitatRoutes,
});
