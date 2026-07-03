import {
  handleNotificationList,
  handleNotificationMarkRead,
  handleNotificationRecipients,
} from "./hub/rpc.ts";

/** Notification feature plugin — registered by platform at boot. */
export const notificationPlugin = {
  id: "notification",
  shell: {
    routes: [{ path: "/notifications", featureId: "notification", navLabel: "Notifications" }],
  },
  hub: {
    rpc: {
      "notification.list": handleNotificationList,
      "notification.markRead": handleNotificationMarkRead,
      "notification.recipients": handleNotificationRecipients,
    },
  },
} as const;
