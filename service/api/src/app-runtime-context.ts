import type { ConversationService } from "@freeanima/orchestration-conversation";

import type { AppRuntimePort } from "./app-runtime-port.ts";
import type { AcpManagerPort } from "./ports/acp-manager.ts";
import type { MaskRegistryPort } from "./ports/mask-registry.ts";
import type { McpManagerPort } from "./ports/mcp-manager.ts";
import type { ServiceEnginePort } from "./ports/service-engine.ts";

export type AppRuntimeContext = {
  conversation: ConversationService;
  engine: ServiceEnginePort;
  masks: MaskRegistryPort;
  mcp: McpManagerPort | null;
  acp: AcpManagerPort;
  host: string;
  port: number;
} & AppRuntimePort;

/** WebUI SSR bundle 与主进程共享；仅限 connector / composition 入口 */
const GLOBAL_CTX_KEY = Symbol.for("freeanima.appRuntime");

let ctx: AppRuntimeContext | null = null;

function readGlobalContext(): AppRuntimeContext | null {
  return (globalThis as Record<symbol, AppRuntimeContext | undefined>)[GLOBAL_CTX_KEY] ?? null;
}

export function registerAppRuntime(next: AppRuntimeContext): void {
  ctx = next;
  (globalThis as Record<symbol, AppRuntimeContext>)[GLOBAL_CTX_KEY] = next;
}

export function unregisterAppRuntime(): void {
  ctx = null;
  delete (globalThis as Record<symbol, AppRuntimeContext | undefined>)[GLOBAL_CTX_KEY];
}

export function getAppRuntime(): AppRuntimeContext {
  const shared = readGlobalContext();
  if (shared) return shared;
  if (!ctx) {
    throw new Error("AppRuntime not initialized");
  }
  return ctx;
}

export function isAppRuntimeReady(): boolean {
  return readGlobalContext() !== null || ctx !== null;
}

export function assertNotShuttingDown(): void {
  if (getAppRuntime().isShuttingDown()) {
    throw new Error("Server is shutting down");
  }
}

/** @deprecated 使用 getAppRuntime */
export const getServiceContext = getAppRuntime;

/** @deprecated 使用 registerAppRuntime */
export const registerServiceContext = registerAppRuntime;

/** @deprecated 使用 unregisterAppRuntime */
export const unregisterServiceContext = unregisterAppRuntime;

/** @deprecated 使用 isAppRuntimeReady */
export const isServiceContextReady = isAppRuntimeReady;

/** @deprecated 使用 AppRuntimeContext */
export type ServiceContext = AppRuntimeContext;

/** @deprecated 使用 AppRuntimePort */
export type AnimaService = AppRuntimePort;
