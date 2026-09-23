import { useEffect } from "react";
import { openNotificationLink } from "@freeanima/portal-sdk/notification-link.ts";

/**
 * Shell 级：伴侣气泡点击 → 主窗跳转（模块 / 容器 / 实体）。
 * 事件由 overlay 经 `ShellApi.navigateMainRoute` 广播；此处只在主窗生效。
 */
export function NotificationLinkShellWatcher() {
  useEffect(() => {
    const off = window.portalShell?.listenMainRoute?.((link) => {
      void openNotificationLink(link);
    });
    return () => off?.();
  }, []);

  return null;
}
