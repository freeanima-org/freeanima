/// <reference lib="dom" />
import {
  resolveHabitatRpcWsUrl,
  getBundledRpcStreamClient,
  resetBundledRpcStreamClientForTests,
  subscribeShellConfigChanges,
  whenBundledRpcStreamClientReady,
  type RpcStreamClient,
} from "@freeanima/shared/rpc-contract";

const CHAT_PLATFORM = "chat";

function resolveHabitatRpcWsUrlFromEnv(): string {
  const shell = window.satelliteShell;
  if (shell?.habitatWsUrl) return shell.habitatWsUrl;
  const fromVite = process.env.VITE_FREEANIMA_HABITAT_WS?.trim();
  if (fromVite) return fromVite;
  return resolveHabitatRpcWsUrl("http://127.0.0.1:2658");
}

function getClient() {
  return getBundledRpcStreamClient({
    habitatRpcWsUrl: resolveHabitatRpcWsUrlFromEnv(),
  });
}

export function getChatRpcStreamClient() {
  return getClient();
}

export function loadChatInstanceId(): string {
  return CHAT_PLATFORM;
}

export function chatPlatform(): string {
  return CHAT_PLATFORM;
}

export async function whenRpcStreamClientReady(): Promise<RpcStreamClient> {
  return whenBundledRpcStreamClientReady();
}

export { subscribeShellConfigChanges };

export function resetChatInstanceCacheForTests(): void {
  resetBundledRpcStreamClientForTests();
}
