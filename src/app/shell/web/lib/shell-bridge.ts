import { isTauriMobileUserAgent, isTauriRuntime } from "@freeanima/client/portal-sdk/tauri-runtime";
import { registerVaultRpcHandlers } from "@freeanima/client/portal-sdk";

import { applyWebUiConfig, fetchWebUiConfig, installShellBridgeReady } from "./bridge/shared.ts";

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  document.documentElement.dataset.appUi = "1";

  try {
    if (isTauriRuntime()) {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) void r.unregister();
        });
      }
      if (isTauriMobileUserAgent()) {
        const { bootstrapTauriMobileBridge } =
          await import("@freeanima/app/shell/tauri/bridge/bootstrap-tauri-mobile.ts");
        await bootstrapTauriMobileBridge();
      } else {
        const { bootstrapTauriBridge } =
          await import("@freeanima/app/shell/tauri/bridge/bootstrap-tauri-desktop.ts");
        await bootstrapTauriBridge();
      }
      registerVaultRpcHandlers();
      return;
    }

    const cfg = await fetchWebUiConfig();
    const { habitatUrl: defaultHubUrl, sameOrigin, remoteAuthToken } = applyWebUiConfig(cfg);
    const { bootstrapWebBridge } = await import("./bridge/bootstrap-web.ts");
    await bootstrapWebBridge(defaultHubUrl, {
      sameOrigin,
      ...(remoteAuthToken ? { remoteAuthToken } : {}),
    });

    registerVaultRpcHandlers();
  } finally {
    finish();
  }
}

void bootstrapShellBridge().catch((err) => {
  console.error("[shell-bridge]", err);
});

export const WEB_SHELL_BRIDGE_MODULE = true;
