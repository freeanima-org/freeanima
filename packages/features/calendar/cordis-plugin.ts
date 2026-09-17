import { createFeaturePlugin } from "@freeanima/server/features/plugin.ts";

import { calendarHabitatRoutes } from "./habitat/routes/index.ts";

/** calendar feature as a Cordis plugin (ctx.features). */
export default createFeaturePlugin({
  id: "calendar",
  routes: calendarHabitatRoutes,
});
