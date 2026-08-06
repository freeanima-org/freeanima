import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";

export const TRANSCRIPT_SCROLL_THRESHOLD_PX = 96;

export type ScrollDownFn = (opts?: { force?: boolean }) => void;

export type TranscriptScrollApi = {
  scrollDown: ScrollDownFn;
  /** 标记贴底（随后非 force 的 scrollDown / contentEpoch 才会滚到底） */
  stick: () => void;
};

/**
 * 消息区贴底滚动：距底小于阈值视为 stick；非 force 时仅 stick 才滚到底。
 */
export function useStickToBottomScroll(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  opts: {
    conversationKey?: string | null;
    /** 内容长度变化时尝试贴底（非 force） */
    contentEpoch: number | string;
  },
): {
  stickToBottomRef: React.MutableRefObject<boolean>;
  scrollDown: ScrollDownFn;
  stick: () => void;
  onScrollPosition: () => void;
  scrollApi: TranscriptScrollApi;
} {
  const stickToBottomRef = useRef(true);

  const scrollDown = useCallback<ScrollDownFn>(
    (scrollOpts) => {
      requestAnimationFrame(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        if (!scrollOpts?.force && !stickToBottomRef.current) return;
        el.scrollTop = el.scrollHeight;
      });
    },
    [scrollContainerRef],
  );

  const stick = useCallback(() => {
    stickToBottomRef.current = true;
  }, []);

  const onScrollPosition = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < TRANSCRIPT_SCROLL_THRESHOLD_PX;
  }, [scrollContainerRef]);

  useEffect(() => {
    stickToBottomRef.current = true;
    scrollDown({ force: true });
  }, [opts.conversationKey, scrollDown]);

  useEffect(() => {
    if (!opts.conversationKey) return;
    scrollDown();
  }, [opts.contentEpoch, opts.conversationKey, scrollDown]);

  const scrollApi = useMemo<TranscriptScrollApi>(
    () => ({ scrollDown, stick }),
    [scrollDown, stick],
  );

  return { stickToBottomRef, scrollDown, stick, onScrollPosition, scrollApi };
}
