import { detectCapacitorShellForBootstrap } from "@freeanima/frontend/shell-sdk/capacitor-local-asset";
import { isCapacitorShellRuntime } from "@freeanima/frontend/shell-sdk/alert/resolve-platform.ts";
import { registerAlertBackend } from "@freeanima/frontend/shell-sdk/alert";
import { isCapacitorShellCandidate } from "@freeanima/frontend/shell-sdk/capacitor-runtime.ts";

/** 按运行时注册本机 Alert backend（不跨端）。 */
export async function registerShellAlertBackend(): Promise<void> {
  if (window.satelliteShell?.isNativeShell || isCapacitorShellCandidate()) {
    const { pinCapacitorNativeBridge } =
      await import("@freeanima/app/shell/mobile/lib/capacitor-plugins.ts");
    const { waitForCapacitorBridge } =
      await import("@freeanima/app/shell/mobile/lib/capacitor-ready.ts");
    pinCapacitorNativeBridge();
    try {
      await waitForCapacitorBridge(2_000);
    } catch {
      /* 桥未就绪时仍尝试注册 mobile 后端，设置页会再补注册 */
    }
  }

  if (window.satelliteShell?.isElectron) {
    const { createDesktopAlertBackend } =
      await import("@freeanima/app/shell/desktop/lib/alert-backend.ts");
    registerAlertBackend(createDesktopAlertBackend());
    return;
  }

  const bundledCapacitorShell = await detectCapacitorShellForBootstrap();
  if (isCapacitorShellRuntime() || bundledCapacitorShell) {
    const { createMobileAlertBackend } =
      await import("@freeanima/app/shell/mobile/lib/alert-backend.ts");
    registerAlertBackend(createMobileAlertBackend());
    return;
  }

  const { createWebShellAlertBackend } = await import("./alert-backend.ts");
  registerAlertBackend(createWebShellAlertBackend());
}
