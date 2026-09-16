import { createFeaturePlugin } from "@freeanima/habitat/platform/features/plugin.ts";

import { mcpHabitatRoutes } from "./habitat/routes/index.ts";

/** mcp feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "mcp",
  routes: mcpHabitatRoutes,
});
