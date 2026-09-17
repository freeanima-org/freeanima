import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { chatHabitatRoutes } from "./habitat/routes/index.ts";

/** chat feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "chat",
  routes: chatHabitatRoutes,
});
