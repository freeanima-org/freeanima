/** Habitat feature plugin — shell embed + Habitat RPC handlers（经 hub-router 注册） */
export const habitatPlugin = {
  id: "habitat",
  shell: {
    routes: [{ path: "/habitat", featureId: "habitat", navLabel: "Habitat" }],
  },
  hub: {},
} as const;
