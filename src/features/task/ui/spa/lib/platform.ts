/** 浏览器 Web 壳（dev:web 等），非 desktop/mobile 原生壳 */
export function isWebShell(): boolean {
  return typeof window !== "undefined" && !window.satelliteShell?.isNativeShell;
}

export {
  isMobileLayoutViewport,
  isNativeShell,
  useDrawerNav,
  useMobileLayout,
} from "@freeanima/frontend/ui-kit/layout";

export {
  useActionSheetCapability as useTaskActionSheet,
  useContextMenuCapability,
  useFinePointerCapability,
  useTouchPrimaryCapability,
} from "@freeanima/frontend/shell-sdk/react.tsx";
