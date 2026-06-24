import type { AppRuntimeContext } from "@freeanima/platform/ports/app-runtime-context";
import { getAppRuntime as defaultGetAppRuntime } from "@freeanima/platform/ports";

type AppRuntimeContextAccessor = () => AppRuntimeContext;

let access: AppRuntimeContextAccessor = defaultGetAppRuntime;

/** 组合根可注入 accessor（测试 / 显式 ctx）；默认仍走 global AppRuntimeContext（SSR 兼容）。 */
export function bindAdminRuntimeContext(accessor?: AppRuntimeContextAccessor): void {
  access = accessor ?? defaultGetAppRuntime;
}

export function adminCtx(): AppRuntimeContext {
  return access();
}
