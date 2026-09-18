import type { ConversationService } from "@freeanima/engine/conversation";
import { getRootContextOrNull } from "@freeanima/kernel";
import { isRecord } from "@freeanima/shared/util";
import type { AppRuntimePort } from "./app-runtime-port.ts";
import type { McpManagerPort } from "./mcp-manager.ts";
import type { RemoteToolsManagerPort } from "./remote-tools-manager.ts";
import type { ServiceEnginePort } from "@freeanima/engine/service-engine.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

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
 * `initRuntimeContext`). 这里按结构判定（不 import server 的 RuntimeService），
 * 使端口层不必反向依赖组合根包。
 */
type RuntimeLike = { app: AppRuntimeContext; deps: FullRuntimeDeps };

function isRuntimeLike(value: unknown): value is RuntimeLike {
  if (!isRecord(value)) return false;
  return isRecord(value.app) && isRecord(value.deps);
}

function runtimeService(): RuntimeLike | null {
  const ctx = getRootContextOrNull();
  if (!ctx) return null;
  const service: unknown = ctx.reflect.get("appRuntime", false);
  return isRuntimeLike(service) ? service : null;
}

export function getAppRuntime(): AppRuntimeContext {
  const service = runtimeService();
  if (!service) throw new Error("AppRuntime not initialized");
  return service.app;
}

/** 组合根注入的完整运行时依赖（特性/能力经端口取用，不 import server）。 */
export function getRuntimeDeps(): FullRuntimeDeps {
  const service = runtimeService();
  if (!service) throw new Error("RuntimeContext not initialized; call serve() first");
  return service.deps;
}

export function isAppRuntimeReady(): boolean {
  return runtimeService() !== null;
}

export function assertNotShuttingDown(): void {
  if (getAppRuntime().isShuttingDown()) {
    throw new Error("Server is shutting down");
  }
}
