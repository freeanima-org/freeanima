import type { FeatureHttpRegistrar } from "@freeanima/platform/features";

/** Console feature plugin — shell embed + transitional REST via console-api hub shim. */
export const consolePlugin = {
  id: "console",
  shell: {
    routes: [{ path: "/console", featureId: "console", navLabel: "Console" }],
  },
  hub: {
    registerHttp(_register: Parameters<FeatureHttpRegistrar>[0]) {
      /* Console REST 由 features/console/hub/console-api createApiApp 挂载；
       * Hub method 薄路由经 invokeConsoleHubHandler（console-hub-handlers.ts）。 */
    },
  },
} as const;
