/** Tag feature plugin — registered by platform at boot. No independent Shell route. */
export const tagPlugin = {
  id: "tag",
  shell: {
    routes: [] as { path: string; featureId: string; navLabel?: string }[],
  },
  hub: {},
} as const;
