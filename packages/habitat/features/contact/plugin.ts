/** Contact feature plugin — registered by platform at boot. */
export const contactPlugin = {
  id: "contact",
  shell: {
    routes: [{ path: "/contacts", featureId: "contact", navLabel: "通讯录" }],
  },
  habitat: {},
} as const;
