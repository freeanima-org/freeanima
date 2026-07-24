import { useEffect, useRef } from "react";
import { useHabitatConnection, useNetworkOnline } from "@freeanima/client/portal-sdk/react.tsx";
import { deliverLocalReminder } from "@freeanima/client/portal-sdk/local-reminder.ts";
import { subscribeConversationInbox } from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { shouldRemindChatUnreadRise } from "@freeanima/features/chat/ui/spa/lib/chat-unread-remind.ts";
import { useChatUnreadStore } from "@freeanima/features/chat/ui/spa/stores/chat-unread.ts";

/** Shell 级用户未读会话数：连接后拉取，inbox 更新时刷新；未读上升时本机提醒 */
export function ChatUnreadShellWatcher() {
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const refreshCount = useChatUnreadStore((s) => s.refreshCount);
  const unreadConversationCount = useChatUnreadStore((s) => s.unreadConversationCount);
  const prevCountRef = useRef<number | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    void refreshCount().then(() => {
      primedRef.current = true;
      prevCountRef.current = useChatUnreadStore.getState().unreadConversationCount;
    });
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

  useEffect(() => {
    const prev = prevCountRef.current;
    const next = unreadConversationCount;
    const should = shouldRemindChatUnreadRise({
      primed: primedRef.current,
      prev,
      next,
    });
    prevCountRef.current = next;
    if (!should) return;
    const delta = prev == null ? next : next - prev;
    void deliverLocalReminder({
      title: "聊天未读",
      body: next === 1 ? "有 1 个会话未读" : `有 ${next} 个会话未读（+${delta}）`,
      tag: "chat-unread",
      sourceRoute: "/chat",
    });
  }, [unreadConversationCount]);

  return null;
}
