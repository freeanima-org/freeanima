/** Bookmark feature plugin — registered by platform at boot. */
export const bookmarkPlugin = {
  id: "bookmark",
  shell: {
    routes: [{ path: "/bookmarks", featureId: "bookmark", navLabel: "Bookmarks" }],
  },
  habitat: {},
} as const;
