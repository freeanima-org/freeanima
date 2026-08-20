import { AsyncLocalStorage } from "node:async_hooks";

import type { VerifiedServiceApiToken } from "./types.ts";
import { getToolCallerAuth } from "@freeanima/habitat/core/tool";

const storage = new AsyncLocalStorage<VerifiedServiceApiToken>();

/** Habitat HTTP/WS RPC：把已验证 token 放入 ALS，供 world/component 与 grants 求交 */
export function runWithServiceApiAuth<T>(auth: VerifiedServiceApiToken, fn: () => T): T {
  return storage.run(auth, fn);
}

/** 优先 RPC ALS，其次 ToolContext.callerAuth（MCP / LLM 工具） */
export function getActiveServiceApiAuth(): VerifiedServiceApiToken | undefined {
  return storage.getStore() ?? getToolCallerAuth();
}
