import { wsOnlyHabitatRoutes } from "../../habitat/ws-only-routes.ts";
import { createFeaturePlugin } from "@freeanima/core/features/plugin.ts";

/** Platform-level WS-only Habitat routes as a feature plugin. */
export default createFeaturePlugin({
  id: "platform-ws-only",
  routes: wsOnlyHabitatRoutes,
});
