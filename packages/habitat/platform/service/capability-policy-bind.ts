/**
 * Sleep / cron 等看不见场景的策略绑定。
 * 对话可见场景不强制收窄（组合根过滤器透传）。
 */
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import {
  filterToolNamesByPolicy,
  resolveCapabilityPolicy,
  resolveSleepPolicy,
  runtimeToolPolicyFromResolved,
  type CapabilityPolicyFragment,
  type ResolvedCapabilityPolicy,
} from "@freeanima/habitat/core/capability-policy";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export { filterToolNamesByPolicy, runtimeToolPolicyFromResolved, type ResolvedCapabilityPolicy };
export {
  materializeFromFragments,
  materializeToolNames,
} from "@freeanima/habitat/core/capability-policy";

export function resolveSleepCapabilityPolicy(deps: FullRuntimeDeps): ResolvedCapabilityPolicy {
  return resolveSleepPolicy(deps.engine.catalog.toolSets);
}

/** 看不见场景：技能 allow 并集 − 调用方 deny（调用方 allow 可选并入） */
export function resolveInvisibleCapabilityPolicy(
  toolSets: ToolSetRegistry,
  input: {
    skills?: readonly CapabilityPolicyFragment[];
    caller?: CapabilityPolicyFragment;
  },
): ResolvedCapabilityPolicy {
  return resolveCapabilityPolicy(input, toolSets);
}

/** @deprecated 兼容旧名 */
export const resolveSleepMask = resolveSleepCapabilityPolicy;
export const filterToolNamesByMask = filterToolNamesByPolicy;
