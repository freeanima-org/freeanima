import type { AnimaService } from "./runtime/anima-service.ts";
import type { Kernel } from "@freeanima/kernel";
import type { Engine } from "@freeanima/engine";
import {
  registerServiceContext,
  type ServiceContext as ServiceContextPort,
} from "@freeanima/service-api/service-context";

export type ServiceContext = ServiceContextPort & {
  kernel: Kernel;
  engine: Engine;
};

const GLOBAL_CTX_KEY = Symbol.for("freeanima.serviceContextFull");

let ctx: ServiceContext | null = null;

function readGlobalContext(): ServiceContext | null {
  return (globalThis as Record<symbol, ServiceContext | undefined>)[GLOBAL_CTX_KEY] ?? null;
}

export function initServiceContext(next: ServiceContext): void {
  ctx = next;
  (globalThis as Record<symbol, ServiceContext>)[GLOBAL_CTX_KEY] = next;
  const { service, conversation, mcp, acp, host, port } = next;
  registerServiceContext({ service, conversation, mcp, acp, host, port });
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

export { assertNotShuttingDown } from "@freeanima/service-api/service-context";

export type { AnimaService };
