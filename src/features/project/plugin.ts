/** Project feature plugin — registered by platform at boot. */
export const projectPlugin = {
  id: "project",
  shell: {
    routes: [{ path: "/projects", featureId: "project", navLabel: "Projects" }],
  },
  habitat: {},
} as const;
