import { useEffect } from "react";
import { useHabitatConnection, useNetworkOnline } from "@freeanima/frontend/shell-sdk/react.tsx";
import { subscribeConversationInbox } from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { useChatUnreadStore } from "@freeanima/features/chat/ui/spa/stores/chat-unread.ts";

/** Shell 级用户未读会话数：连接后拉取，inbox 更新时刷新 */
export function ChatUnreadShellWatcher() {
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const refreshCount = useChatUnreadStore((s) => s.refreshCount);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    void refreshCount();
  }, [networkOnline, habitatConnection, refreshCount]);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    const sub = subscribeConversationInbox(() => {
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
