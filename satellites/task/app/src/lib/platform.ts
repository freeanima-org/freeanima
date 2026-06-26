import { useEffect, useState } from "react";

const MOBILE_LAYOUT_MQ = "(max-width: 1023px)";

/** desktop / web 宽屏支持右键菜单 */
export function isTaskContextMenuEnabled(): boolean {
  return typeof window !== "undefined" && !window.satelliteShell?.isNativeShell;
}

export function isNativeShell(): boolean {
  return typeof window !== "undefined" && Boolean(window.satelliteShell?.isNativeShell);
}

/** 浏览器 Web 壳（dev:web 等），非 desktop/mobile 原生壳 */
export function isWebShell(): boolean {
  return typeof window !== "undefined" && !window.satelliteShell?.isNativeShell;
}

export function isMobileLayoutViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_LAYOUT_MQ).matches;
}

/** 移动布局：窄视口或原生壳层（与 ChatApp lg 断点一致） */
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

/** 移动布局下用 ActionSheet；桌面宽屏用右键 ContextMenu */
export function useTaskActionSheet(): boolean {
  return useMobileLayout();
}
