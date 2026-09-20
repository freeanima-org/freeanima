import type { ConversationService } from "@freeanima/engine/conversation";
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

/** 组合根运行时句柄：由 `initRuntimeContext` 登记。 */
export type AppRuntimePortHandle = {
  app: AppRuntimeContext;
  deps: FullRuntimeDeps;
};

let runtime: AppRuntimePortHandle | null = null;

/**
 * 由组合根登记运行时（server `initRuntimeContext`）。
 *
 * 这里按结构持有（不 import server 的 RuntimeService），使端口层不必反向依赖
 * 组合根包；也不再查进程根 context。
 */
export function setAppRuntimePort(next: AppRuntimePortHandle | null): void {
  runtime = next;
}

export function getAppRuntime(): AppRuntimeContext {
  const service = runtime;
  if (!service) throw new Error("AppRuntime not initialized");
  return service.app;
}

/** 组合根注入的完整运行时依赖（特性/能力经端口取用，不 import server）。 */
export function getRuntimeDeps(): FullRuntimeDeps {
  const service = runtime;
  if (!service) throw new Error("RuntimeContext not initialized; call serve() first");
  return service.deps;
}

export function isAppRuntimeReady(): boolean {
  return runtime !== null;
}

export function assertNotShuttingDown(): void {
  if (getAppRuntime().isShuttingDown()) {
    throw new Error("Server is shutting down");
  }
}
