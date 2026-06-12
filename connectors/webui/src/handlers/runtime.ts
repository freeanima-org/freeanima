import type { AppRuntimeContext } from "@freeanima/service-api/service-context";
import { getAppRuntime as defaultGetAppRuntime } from "@freeanima/service-api";

type AppRuntimeContextAccessor = () => AppRuntimeContext;

let access: AppRuntimeContextAccessor = defaultGetAppRuntime;

/** 组合根可注入 accessor（测试 / 显式 ctx）；默认仍走 global AppRuntimeContext（SSR 兼容）。 */
export function bindWebuiServiceContext(accessor?: AppRuntimeContextAccessor): void {
  access = accessor ?? defaultGetAppRuntime;
}

export function webuiCtx(): AppRuntimeContext {
  return access();
}
