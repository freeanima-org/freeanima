import type { FeatureRpcHandler } from "@freeanima/platform/features";
import { consoleHubHandlers } from "./hub/console-api/console-hub-handlers.ts";
import { tokensHubHandlers } from "./hub/console-api/handlers/service-api-tokens.ts";
import { consolePublicHubHandlers } from "./hub/public-handlers.ts";
import { handleTtsSynthesize } from "./hub/tts-handler.ts";

/** chat plugin 已注册的 method，避免 duplicate handler */
const CHAT_HUB_RPC_METHODS = new Set([
  "conversation.create",
  "conversation.list",
  "conversation.messages",
  "conversation.patchTitle",
  "conversation.archive",
  "conversation.unarchive",
  "conversation.delete",
  "conversation.rollbackBeforeLastUser",
  "conversation.subscribe",
  "conversation.acpDock",
  "conversation.commands",
  "message.send",
  "message.interrupt",
]);

function wrapConsoleHandler(
  fn: (payload: unknown) => Promise<unknown> | unknown,
): FeatureRpcHandler {
  return (_deps, payload) => Promise.resolve(fn(payload));
}

function buildConsoleRpcHandlers(): Record<string, FeatureRpcHandler> {
  const rpc: Record<string, FeatureRpcHandler> = {
    ...consolePublicHubHandlers,
    ...tokensHubHandlers,
  };
  for (const [method, fn] of Object.entries(consoleHubHandlers)) {
    if (CHAT_HUB_RPC_METHODS.has(method)) continue;
    if (method in consolePublicHubHandlers) continue;
    rpc[method] = wrapConsoleHandler(fn as (payload: unknown) => Promise<unknown> | unknown);
  }
  rpc["tts.synthesize"] = handleTtsSynthesize;
  return rpc;
}

/** Console feature plugin — shell embed + Hub RPC handlers */
export const consolePlugin = {
  id: "console",
  shell: {
    routes: [{ path: "/console", featureId: "console", navLabel: "Console" }],
  },
  hub: {
    rpc: buildConsoleRpcHandlers(),
  },
} as const;
