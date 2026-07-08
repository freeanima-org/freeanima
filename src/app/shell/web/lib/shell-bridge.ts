import { detectCapacitorShellForBootstrap } from "@freeanima/shell-sdk/capacitor-local-asset";

import {
  applyWebUiConfig,
  fetchWebUiConfig,
  installShellBridgeReady,
  readDefaultRemoteAuthToken,
} from "./bridge/shared.ts";
import { registerVaultRpcHandlers } from "@freeanima/shell-sdk";

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  document.documentElement.dataset.shellUi = "1";

  try {
    const cfg = await fetchWebUiConfig();
    const { hubUrl: defaultHubUrl, authToken: configAuthToken } = applyWebUiConfig(cfg);
    const defaultToken = readDefaultRemoteAuthToken() || configAuthToken;

    if (window.satelliteShell?.isElectron) {
      const { bootstrapElectronBridge } = await import("./bridge/bootstrap-web.ts");
      await bootstrapElectronBridge(defaultHubUrl, defaultToken);
    } else if (await detectCapacitorShellForBootstrap()) {
      try {
        const { bootstrapCapacitorBridge } = await import("./bridge/bootstrap-capacitor.ts");
        await bootstrapCapacitorBridge();
      } catch (err) {
        console.warn("[shell-bridge] Capacitor bootstrap 失败，回退 Web bridge", err);
        const { bootstrapWebBridge } = await import("./bridge/bootstrap-web.ts");
        await bootstrapWebBridge(defaultHubUrl, defaultToken);
      }
    } else {
      const { bootstrapWebBridge } = await import("./bridge/bootstrap-web.ts");
      await bootstrapWebBridge(defaultHubUrl, defaultToken);
    }

    registerVaultRpcHandlers();
  } finally {
    finish();
  }
}

void bootstrapShellBridge().catch((err) => {
  console.error("[shell-bridge]", err);
});

export const WEB_SHELL_BRIDGE_MODULE = true;
