import { STATIC_METHOD_REGISTRY } from "@freeanima/shared/habitat-contract/registry/index.ts";
import {
  installHubMethodRegistry,
  isHubMethodRegistryInstalled,
} from "@freeanima/shared/habitat-contract/registry/runtime.ts";

import { FEATURE_METHOD_DEFS } from "./feature-method-defs.ts";

let clientRegistryEnsured = false;

/** 浏览器端安装 Habitat method registry（console/ws-only + feature defs，不含 handler 图） */
export function ensureClientHubMethodRegistry(): void {
  if (clientRegistryEnsured || isHubMethodRegistryInstalled()) return;
  clientRegistryEnsured = true;
  installHubMethodRegistry({
    ...STATIC_METHOD_REGISTRY,
    ...FEATURE_METHOD_DEFS,
  });
}

/** @internal 测试重置 */
export function resetClientHubMethodRegistryForTests(): void {
  clientRegistryEnsured = false;
}
