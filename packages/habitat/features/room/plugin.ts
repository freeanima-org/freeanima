/** Room feature plugin — 单机群聊。 */
export const roomPlugin = {
  id: "room",
  shell: {
    routes: [{ path: "/rooms", featureId: "room", navLabel: "群聊" }],
  },
  habitat: {},
} as const;
