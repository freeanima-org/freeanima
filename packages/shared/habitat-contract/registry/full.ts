import { FEATURE_METHOD_DEFS } from "../../rpc-contract/feature-rpc/index.ts";
import { STATIC_METHOD_REGISTRY } from "./index.ts";
import { installHabitatMethodRegistry, isHabitatMethodRegistryInstalled } from "./runtime.ts";

/**
 * Full method registry（static + 所有 feature 的 method defs，不含 handler）。
 *
 * 浏览器入口（portal-sdk）与服务端非浏览器入口（伴侣服务端等）共用同一份
 * 安装逻辑——它们是同一契约，之前分散在两处导致服务端反向依赖 portal-sdk。
 */
let ensured = false;

export function ensureFullHabitatMethodRegistry(): void {
  if (ensured || isHabitatMethodRegistryInstalled()) return;
  ensured = true;
  installHabitatMethodRegistry({ ...STATIC_METHOD_REGISTRY, ...FEATURE_METHOD_DEFS });
}

/** 测试隔离 */
export function resetFullHabitatMethodRegistryForTests(): void {
  ensured = false;
}
