import { useEffect } from "react";
import { useHabitatConnection, useNetworkOnline } from "@freeanima/client/portal-sdk/react.tsx";
import { deliverLocalReminder } from "@freeanima/client/portal-sdk/local-reminder.ts";
import { subscribeUserNotificationInbox } from "@freeanima/features/notification/ui/spa/lib/api.ts";
import { useNotificationUnreadStore } from "@freeanima/features/notification/ui/spa/stores/notification-unread.ts";

/** Shell 级：用户 Inbox 未读数 + 新通知本机提醒 */
export function NotificationReminderShellWatcher() {
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const refreshCount = useNotificationUnreadStore((s) => s.refreshCount);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    void refreshCount();
  }, [networkOnline, habitatConnection, refreshCount]);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    const sub = subscribeUserNotificationInbox((event) => {
      void deliverLocalReminder({
        title: event.title,
        body: event.body,
        tag: `notification:${event.id}`,
        sourceRoute: "/notifications",
      });
      void refreshCount();
    });
    return () => sub.unsubscribe();
  }, [networkOnline, habitatConnection, refreshCount]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshCount]);

  return null;
}
