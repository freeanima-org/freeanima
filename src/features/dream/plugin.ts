/** Dream feature plugin — registered by platform at boot. */
export const dreamPlugin = {
  id: "dream",
  shell: {
    routes: [{ path: "/dream", featureId: "dream", navLabel: "Dream" }],
  },
  hub: {},
} as const;
