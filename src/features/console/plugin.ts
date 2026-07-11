/** Console feature plugin — shell embed + Hub RPC handlers（经 hub-router 注册） */
export const consolePlugin = {
  id: "console",
  shell: {
    routes: [{ path: "/console", featureId: "console", navLabel: "Console" }],
  },
  hub: {},
} as const;
