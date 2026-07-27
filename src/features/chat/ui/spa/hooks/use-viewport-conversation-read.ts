import { useEffect, useRef, type RefObject } from "react";
import { markConversationRead } from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { useChatUnreadStore } from "@freeanima/features/chat/ui/spa/stores/chat-unread.ts";
import { useConversationsStore } from "@freeanima/features/chat/ui/spa/stores/conversations.ts";
import { isHabitatFetchAvailable } from "@freeanima/client/portal-sdk/habitat-fetch-gate";

/**
 * 消息列表底部哨兵进入滚动视口且页面可见时抬已读水位。
 * 滚离底部 / 窗口失焦时不 markRead，当前会话可保持未读并推高 Chat 导航角标。
 */
export function useViewportConversationRead(
  conversationId: string | null,
  displayLength: number,
  scrollRootRef: RefObject<HTMLElement | null>,
): RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inViewRef = useRef(false);
  const markingRef = useRef(false);
  const lastMarkedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    inViewRef.current = false;
    lastMarkedKeyRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    const node = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!node || !root || !conversationId) return;

    const tryMark = () => {
      if (!conversationId) return;
      if (!inViewRef.current) return;
      if (document.visibilityState !== "visible") return;
      if (!isHabitatFetchAvailable()) return;
      if (markingRef.current) return;
      const key = `${conversationId}@${displayLength}`;
      if (lastMarkedKeyRef.current === key) return;
      markingRef.current = true;
      void markConversationRead(conversationId)
        .then(() => {
          lastMarkedKeyRef.current = key;
          useConversationsStore.setState((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === conversationId && c.unread ? { ...c, unread: false } : c,
            ),
          }));
          void useChatUnreadStore.getState().refreshCount();
        })
        .catch((e) => {
          console.error("viewport markConversationRead:", e);
        })
        .finally(() => {
          markingRef.current = false;
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        inViewRef.current = entry?.isIntersecting === true;
        tryMark();
      },
      { root, threshold: 0.01 },
    );
    observer.observe(node);

    const onVisible = () => {
      if (document.visibilityState === "visible") tryMark();
    };
    document.addEventListener("visibilitychange", onVisible);
    tryMark();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [conversationId, displayLength, scrollRootRef]);

  return sentinelRef;
}
