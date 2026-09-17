import { useEffect, type RefObject } from "react";

import { TRANSCRIPT_SCROLL_THRESHOLD_PX } from "./useStickToBottomScroll.ts";

/**
 * 滚动到顶部附近时加载更早消息，并用 scrollHeight 差补偿锚点；
 * 首屏不足一屏时继续拉取直到撑满或无更早消息。
 */
export function useLoadOlderOnScrollTop(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  opts: {
    conversationKey?: string | null;
    hasMoreBefore: boolean;
    loadingOlder: boolean;
    messagesLoading: boolean;
    displayLength: number;
    onLoadOlder?: () => Promise<boolean>;
    /** 与 stick 共用：每次 scroll 时更新贴底状态 */
    onScrollPosition?: () => void;
  },
): void {
  const {
    conversationKey,
    hasMoreBefore,
    loadingOlder,
    messagesLoading,
    displayLength,
    onLoadOlder,
    onScrollPosition,
  } = opts;

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !onLoadOlder) return () => {};
    const onScroll = () => {
      onScrollPosition?.();
      if (
        el.scrollTop < TRANSCRIPT_SCROLL_THRESHOLD_PX &&
        hasMoreBefore &&
        !loadingOlder &&
        !messagesLoading
      ) {
        const prevHeight = el.scrollHeight;
        void onLoadOlder().then((didLoad) => {
          if (!didLoad) return;
          requestAnimationFrame(() => {
            const area = scrollContainerRef.current;
            if (!area) return;
            area.scrollTop += area.scrollHeight - prevHeight;
          });
        });
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [
    scrollContainerRef,
    conversationKey,
    hasMoreBefore,
    loadingOlder,
    messagesLoading,
    onLoadOlder,
    onScrollPosition,
  ]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (
      !el ||
      !conversationKey ||
      messagesLoading ||
      loadingOlder ||
      !hasMoreBefore ||
      !onLoadOlder
    ) {
      return;
    }
    if (el.scrollHeight > el.clientHeight + 8) return;
    void onLoadOlder();
  }, [
    scrollContainerRef,
    conversationKey,
    displayLength,
    hasMoreBefore,
    loadingOlder,
    messagesLoading,
    onLoadOlder,
  ]);
}
