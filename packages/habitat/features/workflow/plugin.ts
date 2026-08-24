/** Workflow feature plugin — tools registered via register-tools. */
export const workflowPlugin = {
  id: "workflow",
  shell: {
    routes: [] as { path: string; featureId: string; navLabel?: string }[],
  },
  habitat: {},
} as const;
