import type { ConversationService } from "@freeanima/habitat/engine/conversation";
import { getRootContextOrNull } from "@freeanima/kernel";

import { RuntimeService } from "../service/runtime-service.ts";
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

/**
 * The service-mounted runtime, or `null` before `initRuntimeContext`.
 *
 * Single source of truth is the Cordis `appRuntime` service (mounted by
 * `initRuntimeContext`); the previous process-global mirror keyed by a
 * `Symbol.for` registry is gone, so a duplicated bundle can no longer observe
 * a second runtime.
 */
function runtimeService(): RuntimeService | null {
  const ctx = getRootContextOrNull();
  if (!ctx) return null;
  const service: unknown = ctx.reflect.get("appRuntime", false);
  return service instanceof RuntimeService ? service : null;
}

export function getAppRuntime(): AppRuntimeContext {
  const service = runtimeService();
  if (!service) throw new Error("AppRuntime not initialized");
  return service.app;
}

export function isAppRuntimeReady(): boolean {
  return runtimeService() !== null;
}

export function assertNotShuttingDown(): void {
  if (getAppRuntime().isShuttingDown()) {
    throw new Error("Server is shutting down");
  }
}
