import type { AppRuntime } from "./runtime/app-runtime.ts";
import type { Kernel } from "@freeanima/kernel";
import type { Engine } from "@freeanima/orchestration-runtime";
import type { MaskRegistry } from "@freeanima/capabilities-mask";
import {
  registerAppRuntime,
  type AppRuntimeContext,
} from "@freeanima/service-api/app-runtime-context";

export type ServiceAppRuntime = AppRuntime & { kernel: Kernel };

let runtime: ServiceAppRuntime | null = null;

export function initAppRuntime(next: ServiceAppRuntime): void {
  runtime = next;
  registerAppRuntime(next);
}

export function getAppRuntime(): ServiceAppRuntime {
  if (!runtime) {
    throw new Error("AppRuntime not initialized");
  }
  return runtime;
}

/** @deprecated 使用 getAppRuntime */
export const getServiceContext = (): AppRuntimeContext & { kernel: Kernel } => getAppRuntime();

/** @deprecated 使用 initAppRuntime */
export const initServiceContext = initAppRuntime;

export function isAppRuntimeReady(): boolean {
  return runtime !== null;
}

/** @deprecated 使用 isAppRuntimeReady */
export const isServiceContextReady = isAppRuntimeReady;

export { assertNotShuttingDown } from "@freeanima/service-api/app-runtime-context";

export type { AppRuntime, Engine, MaskRegistry };
export type ServiceContext = ServiceAppRuntime;
