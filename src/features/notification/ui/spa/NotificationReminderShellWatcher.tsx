import { useEffect } from "react";
import { useHabitatConnection, useNetworkOnline } from "@freeanima/client/portal-sdk/react.tsx";
import { deliverLocalReminder } from "@freeanima/client/portal-sdk/local-reminder.ts";
import { subscribeUserNotificationInbox } from "@freeanima/features/notification/ui/spa/lib/api.ts";

/** Shell 级：用户 Inbox 新通知 → 本机提醒（伴侣气泡 / Alert） */
export function NotificationReminderShellWatcher() {
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    const sub = subscribeUserNotificationInbox((event) => {
      void deliverLocalReminder({
        title: event.title,
        body: event.body,
        tag: `notification:${event.id}`,
        sourceRoute: "/notifications",
      });
    });
    return () => sub.unsubscribe();
  }, [networkOnline, habitatConnection]);

  return null;
}
