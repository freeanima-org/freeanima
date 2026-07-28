import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { mergePolicyFragments } from "./merge.ts";
import type { CapabilityPolicyFragment, ResolvedCapabilityPolicy } from "./types.ts";

export type ResolveCapabilityPolicyInput = {
  /** 已加载技能声明的工具策略（主 allow） */
  skills?: readonly CapabilityPolicyFragment[];
  /** 调用方（cron / sleep / subagent）策略（主 deny，可选 allow） */
  caller?: CapabilityPolicyFragment;
};

const EMPTY: ResolvedCapabilityPolicy = {
  allowed_tools: [],
  denied_tools: [],
};

/**
 * 合成有效工具策略。
 * 技能 allow 并集 ∪ 调用方 allow − 全部 deny；deny 胜出。
 */
export function resolveCapabilityPolicy(
  input: ResolveCapabilityPolicyInput,
  toolSetRegistry: ToolSetRegistry,
): ResolvedCapabilityPolicy {
  const fragments: CapabilityPolicyFragment[] = [...(input.skills ?? [])];
  if (input.caller) {
    fragments.push(input.caller);
  }
  if (fragments.length === 0) return EMPTY;
  return mergePolicyFragments(fragments, toolSetRegistry);
}
