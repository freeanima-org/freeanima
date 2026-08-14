/** Note feature plugin — registered by platform at boot. */
export const notePlugin = {
  id: "note",
  shell: {
    routes: [{ path: "/note", featureId: "note", navLabel: "Notes" }],
  },
  habitat: {},
} as const;
