import type { ConversationService } from "@freeanima/habitat/engine/conversation";

import type { AppRuntimePort } from "./app-runtime-port.ts";
import type { McpManagerPort } from "./mcp-manager.ts";
import type { RemoteToolsManagerPort } from "./remote-tools-manager.ts";
import type { ServiceEnginePort } from "./service-engine.ts";

export type AppRuntimeContext = {
  conversation: ConversationService;
  engine: ServiceEnginePort;
  mcp: McpManagerPort | null;
  outpost: RemoteToolsManagerPort | null;
  host: string;
  port: number;
} & AppRuntimePort;

/** Habitat SSR bundle 与主进程共享；仅限 connector / composition 入口 */
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
  return readGlobalContext() != null || ctx != null;
}

export function assertNotShuttingDown(): void {
  if (getAppRuntime().isShuttingDown()) {
    throw new Error("Server is shutting down");
  }
}
