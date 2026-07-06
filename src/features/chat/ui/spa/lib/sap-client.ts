/// <reference lib="dom" />
import {
  resolveHubRpcWsUrl,
  getBundledSapStreamClient,
  resetBundledSapStreamClientForTests,
  subscribeShellConfigChanges,
  whenBundledSapClientReady,
  type SapClient,
} from "@freeanima/sap-contract";

const CHAT_PLATFORM = "chat";

function resolveHubRpcWsUrlFromEnv(): string {
  const shell = window.satelliteShell;
  if (shell?.hubWsUrl) return shell.hubWsUrl;
  const fromVite = process.env.VITE_FREEANIMA_HUB_WS?.trim();
  if (fromVite) return fromVite;
  return resolveHubRpcWsUrl("http://127.0.0.1:2658");
}

function getClient() {
  return getBundledSapStreamClient({
    hubRpcWsUrl: resolveHubRpcWsUrlFromEnv(),
  });
}

export function getSapDirectClient() {
  return getClient();
}

export function loadChatInstanceId(): string {
  return CHAT_PLATFORM;
}

export function chatPlatform(): string {
  return CHAT_PLATFORM;
}

export async function whenSapClientReady(): Promise<SapClient> {
  return whenBundledSapClientReady();
}

export { subscribeShellConfigChanges };

export function resetChatInstanceCacheForTests(): void {
  resetBundledSapStreamClientForTests();
}
