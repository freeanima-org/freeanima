import { useEffect, useState } from "react";

import { windowWithSatelliteShell } from "./window-shell.ts";

/** 与 Tailwind md 对齐：compact < md，expanded ≥ md */
export const COMPACT_LAYOUT_MAX_PX = 767;
export const MOBILE_LAYOUT_MQ = `(max-width: ${COMPACT_LAYOUT_MAX_PX}px)`;
export const EXPANDED_LAYOUT_MQ = `(min-width: ${COMPACT_LAYOUT_MAX_PX + 1}px)`;

/** 三栏模块：≥ 此宽度三列并列；768–(此值-1) 为桌面两列（清单 drawer） */
export const THREE_COLUMN_WIDE_MIN_PX = 1028;
export const THREE_COLUMN_WIDE_MQ = `(min-width: ${THREE_COLUMN_WIDE_MIN_PX}px)`;

export function isNativeShell(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(windowWithSatelliteShell().satelliteShell?.isNativeShell)
  );
}

export function isMobileLayoutViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_LAYOUT_MQ).matches;
}

export function isThreeColumnWideViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(THREE_COLUMN_WIDE_MQ).matches;
}

/** 窄视口布局（< md） */
export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() => isMobileLayoutViewport());

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}

/** 窄视口：list 栏用 drawer；中宽桌面同样 drawer 清单 */
export function useDrawerNav(): boolean {
  const [drawer, setDrawer] = useState(
    () => isMobileLayoutViewport() || !isThreeColumnWideViewport(),
  );

  useEffect(() => {
    const mobileMq = window.matchMedia(MOBILE_LAYOUT_MQ);
    const wideMq = window.matchMedia(THREE_COLUMN_WIDE_MQ);
    const sync = () => setDrawer(mobileMq.matches || !wideMq.matches);
    sync();
    mobileMq.addEventListener("change", sync);
    wideMq.addEventListener("change", sync);
    return () => {
      mobileMq.removeEventListener("change", sync);
      wideMq.removeEventListener("change", sync);
    };
  }, []);

  return drawer;
}
