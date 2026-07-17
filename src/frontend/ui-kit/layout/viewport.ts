import { useEffect, useState } from "react";

/** 与 Tailwind md 对齐：compact < md，expanded ≥ md */
export const COMPACT_LAYOUT_MAX_PX = 767;
export const COMPACT_LAYOUT_MQ = `(max-width: ${COMPACT_LAYOUT_MAX_PX}px)`;
export const EXPANDED_LAYOUT_MQ = `(min-width: ${COMPACT_LAYOUT_MAX_PX + 1}px)`;

/** 三栏模块：≥ 此宽度三列并列；768–(此值-1) 为桌面两列（清单 drawer） */
export const THREE_COLUMN_WIDE_MIN_PX = 1028;
export const THREE_COLUMN_WIDE_MQ = `(min-width: ${THREE_COLUMN_WIDE_MIN_PX}px)`;

export function isCompactLayoutViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(COMPACT_LAYOUT_MQ).matches;
}

export function isThreeColumnWideViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(THREE_COLUMN_WIDE_MQ).matches;
}

/** 窄视口布局（< md）；仅布局维，与壳/交互无关 */
export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(() => isCompactLayoutViewport());

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_LAYOUT_MQ);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return compact;
}

/** 窄视口：list 栏用 drawer；中宽桌面同样 drawer 清单 */
export function useDrawerNav(): boolean {
  const [drawer, setDrawer] = useState(
    () => isCompactLayoutViewport() || !isThreeColumnWideViewport(),
  );

  useEffect(() => {
    const compactMq = window.matchMedia(COMPACT_LAYOUT_MQ);
    const wideMq = window.matchMedia(THREE_COLUMN_WIDE_MQ);
    const sync = () => setDrawer(compactMq.matches || !wideMq.matches);
    sync();
    compactMq.addEventListener("change", sync);
    wideMq.addEventListener("change", sync);
    return () => {
      compactMq.removeEventListener("change", sync);
      wideMq.removeEventListener("change", sync);
    };
  }, []);

  return drawer;
}
