/** Pomodoro feature plugin — registered by platform at boot. */
export const pomodoroPlugin = {
  id: "pomodoro",
  shell: {
    routes: [{ path: "/pomodoro", featureId: "pomodoro", navLabel: "Pomodoro" }],
  },
  hub: {},
} as const;
