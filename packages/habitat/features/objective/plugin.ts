/** Objective feature plugin — registered by platform at boot. */
export const objectivePlugin = {
  id: "objective",
  shell: {
    routes: [{ path: "/objectives", featureId: "objective", navLabel: "目标" }],
  },
  habitat: {},
} as const;
