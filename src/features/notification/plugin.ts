/** Notification feature plugin — registered by platform at boot. */
export const notificationPlugin = {
  id: "notification",
  shell: {
    routes: [{ path: "/notifications", featureId: "notification", navLabel: "Notifications" }],
  },
  hub: {},
} as const;
