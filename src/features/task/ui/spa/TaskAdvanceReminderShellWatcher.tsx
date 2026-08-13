import { useEffect } from "react";
import { useHabitatConnection, useNetworkOnline } from "@freeanima/client/portal-sdk/react.tsx";
import { deliverLocalReminder } from "@freeanima/client/portal-sdk/local-reminder.ts";

import { subscribeTaskAdvanceReminders } from "./lib/api.ts";

/** Shell 级：任务提前提醒 → 本机 Alert（不写 Inbox） */
export function TaskAdvanceReminderShellWatcher() {
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return () => {};
    const sub = subscribeTaskAdvanceReminders((event) => {
      void deliverLocalReminder({
        title: event.title,
        body: event.body,
        tag: event.source_ref,
        sourceRoute: `/tasks?item=${event.task_item_id}`,
      });
    });
    return () => sub.unsubscribe();
  }, [networkOnline, habitatConnection]);

  return null;
}
