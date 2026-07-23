import { STATIC_METHOD_REGISTRY } from "@freeanima/shared/habitat-contract/registry/index.ts";
import {
  installHabitatMethodRegistry,
  isHabitatMethodRegistryInstalled,
} from "@freeanima/shared/habitat-contract/registry/runtime.ts";

import { FEATURE_METHOD_DEFS } from "./feature-method-defs.ts";

let clientRegistryEnsured = false;

/** 浏览器端安装 Habitat method registry（console/ws-only + feature defs，不含 handler 图） */
export function ensureClientHabitatMethodRegistry(): void {
  if (clientRegistryEnsured || isHabitatMethodRegistryInstalled()) return;
  clientRegistryEnsured = true;
  installHabitatMethodRegistry({
    ...STATIC_METHOD_REGISTRY,
    ...FEATURE_METHOD_DEFS,
  });
}

/** @internal 测试重置 */
export function resetClientHabitatMethodRegistryForTests(): void {
  clientRegistryEnsured = false;
}
