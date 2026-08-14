/** Habitat feature plugin — shell embed + Habitat RPC handlers（经 habitat-router 注册） */
export const habitatPlugin = {
  id: "habitat",
  shell: {
    routes: [{ path: "/habitat", featureId: "habitat", navLabel: "Habitat" }],
  },
  habitat: {},
} as const;
