import { registerAlertBackend } from "@freeanima/frontend/portal-sdk/alert";
import { getShellBuildTarget } from "@freeanima/frontend/portal-sdk/shell-build-target.ts";
import {
  isTauriMobileUserAgent,
  isTauriRuntime,
} from "@freeanima/frontend/portal-sdk/tauri-runtime";

/** 按运行时注册本机 Alert backend（不跨端）。 */
export async function registerShellAlertBackend(): Promise<void> {
  const buildTarget = getShellBuildTarget();
  const tauri = Boolean(window.portalShell?.isTauri) || isTauriRuntime();

  if (tauri && (buildTarget === "mobile" || isTauriMobileUserAgent())) {
    const { createMobileAlertBackend } =
      await import("@freeanima/app/shell/tauri/lib/mobile-alert-backend.ts");
    registerAlertBackend(createMobileAlertBackend());
    return;
  }

  if (buildTarget === "desktop" || tauri) {
    const { createDesktopAlertBackend } =
      await import("@freeanima/app/shell/tauri/lib/desktop-alert-backend.ts");
    registerAlertBackend(createDesktopAlertBackend());
    return;
  }

  const { createWebShellAlertBackend } = await import("./alert-backend.ts");
  registerAlertBackend(createWebShellAlertBackend());
}
