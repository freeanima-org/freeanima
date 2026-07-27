import { create } from "zustand";
import { getUnreadNotificationCount } from "@freeanima/features/notification/ui/spa/lib/api.ts";
import { isHabitatFetchAvailable } from "@freeanima/client/portal-sdk/habitat-fetch-gate";

type NotificationUnreadState = {
  unreadCount: number;
  setCount: (count: number) => void;
  refreshCount: () => Promise<number>;
};

export const useNotificationUnreadStore = create<NotificationUnreadState>((set) => ({
  unreadCount: 0,
  setCount(count) {
    set({ unreadCount: Math.max(0, Math.floor(count)) });
  },
  async refreshCount() {
    if (!isHabitatFetchAvailable()) return 0;
    try {
      const count = await getUnreadNotificationCount();
      set({ unreadCount: count });
      return count;
    } catch (e) {
      console.error("refreshNotificationUnreadCount:", e);
      return 0;
    }
  },
}));
