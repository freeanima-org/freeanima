import { getRootContextOrNull } from "@freeanima/kernel";
import { isRecord } from "@freeanima/shared/util";

import type { FeatureRpcHandler, FeatureRegistryPort } from "./types.ts";

function isFeatureRegistry(value: unknown): value is FeatureRegistryPort {
  if (!isRecord(value)) return false;
  return typeof value.getHandler === "function" && typeof value.provide === "function";
}

/** `ctx.features` 上的 handler 查找（能力层 dispatch 用，无需依赖组合根包）。 */
export function getFeatureRpcHandler(method: string): FeatureRpcHandler | undefined {
  const ctx = getRootContextOrNull();
  if (!ctx) return undefined;
  const service: unknown = ctx.reflect.get("features", false);
  return isFeatureRegistry(service) ? service.getHandler(method) : undefined;
}
