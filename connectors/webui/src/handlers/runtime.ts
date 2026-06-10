import type { ServiceContext } from "@freeanima/service-api/service-context";
import { getServiceContext as defaultGetServiceContext } from "@freeanima/service-api";

type ServiceContextAccessor = () => ServiceContext;

let access: ServiceContextAccessor = defaultGetServiceContext;

/** 组合根可注入 accessor（测试 / 显式 ctx）；默认仍走 global ServiceContext（SSR 兼容）。 */
export function bindWebuiServiceContext(accessor?: ServiceContextAccessor): void {
  access = accessor ?? defaultGetServiceContext;
}

export function webuiCtx(): ServiceContext {
  return access();
}
