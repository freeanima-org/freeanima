import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { shellQuickHabitatRoutes } from "./habitat/routes/index.ts";

/** shell-quick feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "shell-quick",
  routes: shellQuickHabitatRoutes,
});
