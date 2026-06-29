import { useMobileLayout } from "@freeanima/satellite-sdk/layout";

/** desktop / web 宽屏支持右键菜单 */
export function isTaskContextMenuEnabled(): boolean {
  return typeof window !== "undefined" && !window.satelliteShell?.isNativeShell;
}

/** 浏览器 Web 壳（dev:web 等），非 desktop/mobile 原生壳 */
export function isWebShell(): boolean {
  return typeof window !== "undefined" && !window.satelliteShell?.isNativeShell;
}

export {
  isMobileLayoutViewport,
  isNativeShell,
  useDrawerNav,
  useMobileLayout,
} from "@freeanima/satellite-sdk/layout";

/** 移动布局下用 ActionSheet；桌面宽屏用右键 ContextMenu */
export function useTaskActionSheet(): boolean {
  return useMobileLayout();
}
