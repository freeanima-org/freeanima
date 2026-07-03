import type { FeatureHttpRegistrar } from "@freeanima/platform/features";

/** Console feature plugin — shell embed + transitional REST via admin-api hub shim. */
export const consolePlugin = {
  id: "console",
  shell: {
    routes: [{ path: "/admin", featureId: "console", navLabel: "Console" }],
  },
  hub: {
    registerHttp(_register: Parameters<FeatureHttpRegistrar>[0]) {
      /* REST routes remain in @freeanima/admin-api until hub/http fully colocated. */
    },
  },
} as const;
