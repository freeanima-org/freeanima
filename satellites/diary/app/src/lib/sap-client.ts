import {
  DIARY_INSTANCE_ID,
  createSapDirectClient,
  resolveHubWsUrl,
  type SapDirectClient,
  type SapConnectionState,
} from "@freeanima/sap-contract";

const APP_ID = "diary";
const SHELL_CONFIG_CHANGED_EVENT = "freeanima:shell-config-changed";

let directClient: SapDirectClient | null = null;
let connectionState: SapConnectionState = "connecting";

function resolveHubWsUrlFromEnv(): string {
  const shell = window.satelliteShell;
  if (shell?.hubWsUrl) return shell.hubWsUrl;
  const env = (import.meta as ImportMeta & { env?: { VITE_FREEANIMA_HUB_WS?: string } }).env;
  if (env?.VITE_FREEANIMA_HUB_WS?.trim()) return env.VITE_FREEANIMA_HUB_WS.trim();
  return resolveHubWsUrl("http://127.0.0.1:2658");
}

export function getSapDirectClient(): SapDirectClient {
  if (!directClient) {
    connectionState = "connecting";
    const nativeShell =
      typeof window !== "undefined" && Boolean(window.satelliteShell?.isNativeShell);
    const remoteAuthToken = window.satelliteShell?.remoteAuth?.token;
    directClient = createSapDirectClient({
      appId: APP_ID,
      hubWsUrl: resolveHubWsUrlFromEnv(),
      instanceId: DIARY_INSTANCE_ID,
      useSharedWorker: !nativeShell,
      ...(remoteAuthToken !== undefined ? { remoteAuthToken } : {}),
      onConnectionStateChange: (connected) => {
        connectionState = connected ? "connected" : "disconnected";
      },
    });
    void directClient
      .whenReady()
      .then(() => {
        connectionState = "connected";
      })
      .catch(() => {
        connectionState = "disconnected";
      });
  }
  return directClient;
}

export function getSapConnectionState(): SapConnectionState {
  return connectionState;
}

export async function whenSapClientReady() {
  return getSapDirectClient().whenReady();
}

export function subscribeShellConfigChanges(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (): void => {
    directClient?.stop();
    directClient = null;
    connectionState = "connecting";
    getSapDirectClient();
  };
  window.addEventListener(SHELL_CONFIG_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SHELL_CONFIG_CHANGED_EVENT, handler);
}

export function resetDiarySapClientForTests(): void {
  directClient?.stop();
  directClient = null;
  connectionState = "connecting";
}
