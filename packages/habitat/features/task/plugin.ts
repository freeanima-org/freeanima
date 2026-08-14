/** Task feature plugin — registered by platform at boot. */
export const taskPlugin = {
  id: "task",
  shell: {
    routes: [{ path: "/tasks", featureId: "task", navLabel: "Tasks" }],
  },
  habitat: {},
} as const;
