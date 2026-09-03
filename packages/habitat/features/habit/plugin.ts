/** Habit feature plugin — registered by platform at boot. */
export const habitPlugin = {
  id: "habit",
  shell: {
    routes: [{ path: "/habits", featureId: "habit", navLabel: "习惯" }],
  },
  habitat: {},
} as const;
