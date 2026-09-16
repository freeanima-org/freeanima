import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { vaultHabitatRoutes } from "./habitat/routes/index.ts";

/** vault feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "vault",
  routes: vaultHabitatRoutes,
});
