import {
  applyWebUiConfig,
  fetchWebUiConfig,
  installShellBridgeReady,
  isCapacitorRuntime,
  readDefaultRemoteAuthToken,
} from "./bridge/shared.ts";

async function bootstrapShellBridge(): Promise<void> {
  const finish = installShellBridgeReady();
  document.documentElement.dataset.shellUi = "1";

  try {
    const cfg = await fetchWebUiConfig();
    const defaultHubUrl = applyWebUiConfig(cfg);
    const defaultToken = readDefaultRemoteAuthToken();

    if (window.satelliteShell?.isElectron) {
      const { bootstrapElectronBridge } = await import("./bridge/bootstrap-web.ts");
      await bootstrapElectronBridge(defaultHubUrl, defaultToken);
    } else if (isCapacitorRuntime()) {
      const { bootstrapCapacitorBridge } = await import("./bridge/bootstrap-capacitor.ts");
      await bootstrapCapacitorBridge();
    } else {
      const { bootstrapWebBridge } = await import("./bridge/bootstrap-web.ts");
      await bootstrapWebBridge(defaultHubUrl, defaultToken);
    }
  } finally {
    finish();
  }
}

void bootstrapShellBridge().catch((err) => {
  console.error("[shell-bridge]", err);
});

export const WEB_SHELL_BRIDGE_MODULE = true;
