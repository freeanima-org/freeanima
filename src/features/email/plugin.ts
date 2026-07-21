/** Email feature plugin — registered by platform at boot. */
export const emailPlugin = {
  id: "email",
  shell: {
    routes: [{ path: "/email", featureId: "email", navLabel: "Email" }],
  },
  habitat: {},
} as const;
