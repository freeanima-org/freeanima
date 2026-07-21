/** Chat feature plugin — shell + conversation/message Habitat RPC. */
export const chatPlugin = {
  id: "chat",
  shell: {
    routes: [{ path: "/chat", featureId: "chat", navLabel: "Chat" }],
  },
  habitat: {},
} as const;
