/** Diary feature plugin — registered by platform at boot. */
export const diaryPlugin = {
  id: "diary",
  shell: {
    routes: [{ path: "/diary", featureId: "diary", navLabel: "Diary" }],
  },
  hub: {},
} as const;
