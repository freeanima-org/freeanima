import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

import { subagentHabitatRoutes } from "./habitat/routes/index.ts";

/** subagent feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "subagent",
  routes: subagentHabitatRoutes,
});
