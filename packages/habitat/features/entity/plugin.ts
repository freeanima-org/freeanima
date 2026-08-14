/** Entity feature plugin — registered by platform at boot. */
export const entityPlugin = {
  id: "entity",
  shell: {
    routes: [{ path: "/entity", featureId: "entity", navLabel: "Entity" }],
  },
  habitat: {},
} as const;
