/** Subagent feature plugin — Habitat admin UI; tools registered via register-tools. */
export const subagentPlugin = {
  id: "subagent",
  shell: {
    routes: [] as { path: string; featureId: string; navLabel?: string }[],
  },
  habitat: {},
} as const;
