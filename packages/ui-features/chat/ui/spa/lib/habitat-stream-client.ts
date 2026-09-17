/// <reference lib="dom" />
import type { RpcStreamClient } from "@freeanima/shared/rpc-contract";
import {
  getBundledRpcStreamClient,
  resetBundledRpcStreamClientForTests,
  subscribeShellConfigChanges,
  whenBundledRpcStreamClientReady,
} from "@freeanima/shared/rpc-contract/bundled-rpc-stream-browser.ts";

const CHAT_PLATFORM = "chat";

/** 不向单例注入冻结 URL；bundled-browser 每次 reconnect 从 portalShell 读最新地址 */
export function getChatRpcStreamClient() {
  return getBundledRpcStreamClient();
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
