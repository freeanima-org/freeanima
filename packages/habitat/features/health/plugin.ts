/** Health feature plugin — registered by platform at boot. */
export const healthPlugin = {
  id: "health",
  shell: {
    routes: [{ path: "/health", featureId: "health", navLabel: "健康" }],
  },
  habitat: {},
} as const;
