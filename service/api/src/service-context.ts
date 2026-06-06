import type { AcpManager } from "@freeanima/capabilities-acp";
import type { MCPManager } from "@freeanima/capabilities-mcp";
import type { ConversationService } from "@freeanima/engine-conversation";

import type { RuntimeService } from "./runtime-service.ts";

export type ServiceContext = {
  service: RuntimeService;
  conversation: ConversationService;
  mcp: MCPManager | null;
  acp: AcpManager;
  host: string;
  port: number;
};

/** WebUI SSR bundle 会复制一份模块；用 globalThis 与 anima service 主进程共享 */
const GLOBAL_CTX_KEY = Symbol.for("freeanima.serviceContext");

let ctx: ServiceContext | null = null;

function readGlobalContext(): ServiceContext | null {
  return (globalThis as Record<symbol, ServiceContext | undefined>)[GLOBAL_CTX_KEY] ?? null;
}

export function registerServiceContext(next: ServiceContext): void {
  ctx = next;
  (globalThis as Record<symbol, ServiceContext>)[GLOBAL_CTX_KEY] = next;
}

export function unregisterServiceContext(): void {
  ctx = null;
  delete (globalThis as Record<symbol, ServiceContext | undefined>)[GLOBAL_CTX_KEY];
}

export function getServiceContext(): ServiceContext {
  const shared = readGlobalContext();
  if (shared) return shared;
  if (!ctx) {
    throw new Error("ServiceContext 未初始化");
  }
  return ctx;
}

export function isServiceContextReady(): boolean {
  return readGlobalContext() !== null || ctx !== null;
}

export function assertNotShuttingDown(): void {
  const { service } = getServiceContext();
  if (service.isShuttingDown()) {
    throw new Error("Server is shutting down");
  }
}
