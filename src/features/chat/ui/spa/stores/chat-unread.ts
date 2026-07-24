import { create } from "zustand";
import { getUnreadConversationCount } from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { isHabitatFetchAvailable } from "@freeanima/frontend/portal-sdk/habitat-fetch-gate";

type ChatUnreadState = {
  unreadConversationCount: number;
  setCount: (count: number) => void;
  refreshCount: () => Promise<number>;
};

export const useChatUnreadStore = create<ChatUnreadState>((set) => ({
  unreadConversationCount: 0,
  setCount(count) {
    set({ unreadConversationCount: Math.max(0, Math.floor(count)) });
  },
  async refreshCount() {
    if (!isHabitatFetchAvailable()) return 0;
    try {
      const count = await getUnreadConversationCount();
      set({ unreadConversationCount: count });
      return count;
    } catch (e) {
      console.error("refreshUnreadCount:", e);
      return 0;
    }
  },
}));
