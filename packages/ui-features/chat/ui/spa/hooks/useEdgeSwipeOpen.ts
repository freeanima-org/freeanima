import { useMemo, useRef } from "react";

type Options = {
  enabled: boolean;
  onOpen: () => void;
  /** 从左缘多少 px 内起手算边缘滑动 */
  edgePx?: number;
  /** 最小水平位移（px） */
  minDx?: number;
};

export function useEdgeSwipeOpen({ enabled, onOpen, edgePx = 28, minDx = 56 }: Options) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  return useMemo(
    () => ({
      onTouchStart(e: React.TouchEvent) {
        if (!enabled) return;
        const t = e.touches[0];
        if (!t || t.clientX > edgePx) return;
        touchStart.current = { x: t.clientX, y: t.clientY };
      },
      onTouchEnd(e: React.TouchEvent) {
        if (!enabled || !touchStart.current) return;
        const t = e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - touchStart.current.x;
        const dy = t.clientY - touchStart.current.y;
        touchStart.current = null;
        if (dx >= minDx && Math.abs(dy) <= 48) onOpen();
      },
      onTouchCancel() {
        touchStart.current = null;
      },
    }),
    [enabled, onOpen, edgePx, minDx],
  );
}
