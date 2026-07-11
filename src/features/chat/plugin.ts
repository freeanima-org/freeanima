/** Chat feature plugin — shell + conversation/message Hub RPC. */
export const chatPlugin = {
  id: "chat",
  shell: {
    routes: [{ path: "/chat", featureId: "chat", navLabel: "Chat" }],
  },
  hub: {},
} as const;
