/// <reference lib="dom" />
import {
  resolveHabitatRpcWsUrl,
  getBundledSapStreamClient,
  resetBundledSapStreamClientForTests,
  subscribeShellConfigChanges,
  whenBundledSapClientReady,
  type SapClient,
} from "@freeanima/shared/sap-contract";

const CHAT_PLATFORM = "chat";

function resolveHabitatRpcWsUrlFromEnv(): string {
  const shell = window.satelliteShell;
  if (shell?.habitatWsUrl) return shell.habitatWsUrl;
  const fromVite = process.env.VITE_FREEANIMA_HUB_WS?.trim();
  if (fromVite) return fromVite;
  return resolveHabitatRpcWsUrl("http://127.0.0.1:2658");
}

function getClient() {
  return getBundledSapStreamClient({
    hubRpcWsUrl: resolveHabitatRpcWsUrlFromEnv(),
  });
}

export function getChatSapClient() {
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
