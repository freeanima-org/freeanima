/** Shell quick feature plugin — no independent Shell module route. */
export const shellQuickPlugin = {
  id: "shell-quick",
  shell: {
    routes: [] as { path: string; featureId: string; navLabel?: string }[],
  },
  habitat: {},
} as const;
