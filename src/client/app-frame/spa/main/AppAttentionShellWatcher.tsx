import { useEffect, useRef } from "react";
import {
  requestShellAppAttention,
  syncAppBadgeCount,
} from "@freeanima/client/portal-sdk/app-badge.ts";
import { useChatUnreadStore } from "@freeanima/features/chat/ui/spa/stores/chat-unread.ts";
import { useNotificationUnreadStore } from "@freeanima/features/notification/ui/spa/stores/notification-unread.ts";

/** Shell 级：对话未读 + 通知未读合计 → 应用图标角标；上升且失焦时请求 attention */
export function AppAttentionShellWatcher() {
  const chatCount = useChatUnreadStore((s) => s.unreadConversationCount);
  const notificationCount = useNotificationUnreadStore((s) => s.unreadCount);
  const total = chatCount + notificationCount;
  const prevTotalRef = useRef(0);

  useEffect(() => {
    void syncAppBadgeCount(total);
    const prev = prevTotalRef.current;
    prevTotalRef.current = total;
    if (total > prev && typeof document !== "undefined" && !document.hasFocus()) {
      void requestShellAppAttention();
    }
  }, [total]);

  return null;
}
