/** Calendar feature plugin — registered by platform at boot. */
export const calendarPlugin = {
  id: "calendar",
  shell: {
    routes: [{ path: "/calendar", featureId: "calendar", navLabel: "Calendar" }],
  },
  habitat: {},
} as const;
