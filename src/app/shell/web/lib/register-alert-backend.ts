import { isMobileCapacitorShellCandidate } from "@freeanima/frontend/shell-sdk/capacitor-runtime.ts";
import { registerAlertBackend } from "@freeanima/frontend/shell-sdk/alert";
import { detectShellRuntimeKind } from "./shell-composition.ts";

/** 按运行时注册本机 Alert backend（不跨端）。 */
export async function registerShellAlertBackend(): Promise<void> {
  if (window.satelliteShell?.isNativeShell || isMobileCapacitorShellCandidate()) {
    const { waitForCapacitorNativePlatform } =
      await import("@freeanima/frontend/shell-sdk/capacitor-runtime.ts");
    await waitForCapacitorNativePlatform(5_000);
  }
  const kind = detectShellRuntimeKind();
  if (kind === "electron") {
    const { createDesktopAlertBackend } =
      await import("@freeanima/app/shell/desktop/lib/alert-backend.ts");
    registerAlertBackend(createDesktopAlertBackend());
    return;
  }
  if (kind === "capacitor") {
    const { createMobileAlertBackend } =
      await import("@freeanima/app/shell/mobile/lib/alert-backend.ts");
    registerAlertBackend(createMobileAlertBackend());
    return;
  }
  const { createWebShellAlertBackend } = await import("./alert-backend.ts");
  registerAlertBackend(createWebShellAlertBackend());
}
