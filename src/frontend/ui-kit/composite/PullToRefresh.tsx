import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";

import { Spinner } from "../components/ui/spinner.tsx";
import { cn } from "../lib/cn.ts";
import { m } from "./i18n.ts";
import {
  PULL_TO_REFRESH_EDGE_IGNORE_PX,
  PULL_TO_REFRESH_MAX_PULL_PX,
  PULL_TO_REFRESH_THRESHOLD_PX,
  canStartPullAtScrollTop,
  clampPullDistance,
  detectTouchPrimaryInput,
  shouldIgnorePullStart,
  shouldTriggerRefresh,
} from "./pull-to-refresh-logic.ts";

export type PullToRefreshProps = {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  disabled?: boolean;
  /** Override auto touch detection. Default: enable only for touch-primary input. */
  enabled?: boolean;
  className?: string;
  contentClassName?: string;
  edgeIgnorePx?: number;
  thresholdPx?: number;
};

export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  enabled,
  className,
  contentClassName,
  edgeIgnorePx = PULL_TO_REFRESH_EDGE_IGNORE_PX,
  thresholdPx = PULL_TO_REFRESH_THRESHOLD_PX,
}: PullToRefreshProps) {
  const [touchPrimary, setTouchPrimary] = useState(() =>
    typeof window === "undefined" ? false : detectTouchPrimaryInput(),
  );
  const gestureEnabled = (enabled ?? touchPrimary) && !disabled;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (enabled != null) return;
    const sync = () => setTouchPrimary(detectTouchPrimaryInput());
    sync();
    const mqFine = window.matchMedia("(pointer: fine)");
    const mqHover = window.matchMedia("(hover: hover)");
    mqFine.addEventListener("change", sync);
    mqHover.addEventListener("change", sync);
    return () => {
      mqFine.removeEventListener("change", sync);
      mqHover.removeEventListener("change", sync);
    };
  }, [enabled]);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPullDistance(PULL_TO_REFRESH_THRESHOLD_PX);
    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPullDistance(0);
      pullingRef.current = false;
    }
  }, [onRefresh]);

  const onTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!gestureEnabled || refreshingRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (shouldIgnorePullStart(touch.clientX, edgeIgnorePx)) {
        pullingRef.current = false;
        return;
      }
      const scroller = scrollerRef.current;
      if (!scroller || !canStartPullAtScrollTop(scroller.scrollTop)) {
        pullingRef.current = false;
        return;
      }
      startYRef.current = touch.clientY;
      pullingRef.current = true;
      setPullDistance(0);
    },
    [edgeIgnorePx, gestureEnabled],
  );

  const onTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!gestureEnabled || !pullingRef.current || refreshingRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      if (!canStartPullAtScrollTop(scroller.scrollTop)) {
        pullingRef.current = false;
        setPullDistance(0);
        return;
      }
      const dy = touch.clientY - startYRef.current;
      if (dy <= 0) {
        setPullDistance(0);
        return;
      }
      // Only preventDefault once we are clearly pulling down from top.
      if (e.cancelable) e.preventDefault();
      setPullDistance(clampPullDistance(dy, PULL_TO_REFRESH_MAX_PULL_PX));
    },
    [gestureEnabled],
  );

  const onTouchEnd = useCallback(() => {
    if (!gestureEnabled || !pullingRef.current) return;
    pullingRef.current = false;
    const distance = pullDistance;
    if (shouldTriggerRefresh(distance, thresholdPx)) {
      void runRefresh();
      return;
    }
    setPullDistance(0);
  }, [gestureEnabled, pullDistance, runRefresh, thresholdPx]);

  const indicatorStyle: CSSProperties = {
    height: refreshing ? thresholdPx : pullDistance,
    opacity: refreshing || pullDistance > 0 ? 1 : 0,
  };

  const label = refreshing
    ? m.habitat_common_refreshing()
    : shouldTriggerRefresh(pullDistance, thresholdPx)
      ? m.habitat_common_refresh()
      : m.habitat_common_refresh();

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div
        className="text-muted-foreground flex shrink-0 items-center justify-center gap-2 overflow-hidden text-xs transition-[height,opacity]"
        style={indicatorStyle}
        aria-hidden={pullDistance === 0 && !refreshing}
      >
        {(refreshing || pullDistance > 8) && (
          <>
            <Spinner className="size-3.5" />
            <span>{label}</span>
          </>
        )}
      </div>
      <div
        ref={scrollerRef}
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-y-contain", contentClassName)}
        onTouchStart={gestureEnabled ? onTouchStart : undefined}
        onTouchMove={gestureEnabled ? onTouchMove : undefined}
        onTouchEnd={gestureEnabled ? onTouchEnd : undefined}
        onTouchCancel={gestureEnabled ? onTouchEnd : undefined}
      >
        {children}
      </div>
    </div>
  );
}
