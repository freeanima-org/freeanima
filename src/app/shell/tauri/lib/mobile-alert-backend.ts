import { createWebAlertBackend } from "@freeanima/frontend/shell-sdk/alert/web-backend.ts";
import type { AlertBackend } from "@freeanima/frontend/shell-sdk/alert/types.ts";

import { createDesktopAlertBackend } from "./desktop-alert-backend.ts";

/** Tauri 移动壳：与桌面相同走 portalShell 原生通知，platform 标记 mobile。 */
export function createMobileAlertBackend(): AlertBackend {
  const native = createDesktopAlertBackend();
  if (native.platform === "desktop" && window.portalShell?.showNativeAlert) {
    return { ...native, platform: "mobile" };
  }
  return {
    ...createWebAlertBackend(),
    platform: "mobile",
  };
}
