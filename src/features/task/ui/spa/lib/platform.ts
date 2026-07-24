import { isCompactLayoutViewport, useCompactLayout, useDrawerNav } from "@freeanima/ui-kit/layout";
import {
  getShellKind,
  isNativeShell,
  useActionSheetCapability as useTaskActionSheet,
  useContextMenuCapability,
  useFinePointerCapability,
  useTouchPrimaryCapability,
} from "@freeanima/client/portal-sdk/react.tsx";

/** 纯浏览器 Web 壳（非 Tauri） */
export function isWebShell(): boolean {
  return getShellKind() === "web";
}

export {
  getShellKind,
  isCompactLayoutViewport,
  isNativeShell,
  useCompactLayout,
  useDrawerNav,
  useContextMenuCapability,
  useFinePointerCapability,
  useTaskActionSheet,
  useTouchPrimaryCapability,
};
