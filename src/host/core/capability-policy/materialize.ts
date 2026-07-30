import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { TOOL_SET_LOAD_TOOL_NAME, TOOL_SET_SEARCH_TOOL_NAME } from "@freeanima/host/core/tool";

import { expandToolSets } from "./expand.ts";
import type { CapabilityPolicyFragment, ResolvedCapabilityPolicy } from "./types.ts";

/** 策略运行禁止出现的工具（防 progressive load / 嵌套派发越权） */
export const POLICY_RUN_HARD_DENIED_TOOLS = [
  TOOL_SET_LOAD_TOOL_NAME,
  TOOL_SET_SEARCH_TOOL_NAME,
] as const;

/**
 * 将已解析策略物化为具体工具名列表（供 LLM `tools` / `executableTools`）。
 * deny 已在 resolve 时从 allow 剔除；此处再并入 HARD_DENY。
 */
export function materializeToolNames(
  resolved: ResolvedCapabilityPolicy,
  extraHardDeny: readonly string[] = [],
): string[] {
  const hard = new Set<string>([...POLICY_RUN_HARD_DENIED_TOOLS, ...extraHardDeny]);
  return resolved.allowed_tools.filter((name) => !hard.has(name)).toSorted();
}

/**
 * Subagent 严格合成：entity.allowed 为唯一天花板；skills 仅并入 deny；再 HARD_DENY。
 */
export function resolveSubagentToolPolicy(
  input: {
    entityAllowed: readonly string[];
    entityDenied: readonly string[];
    skillDenies?: readonly string[];
    callExtraDenied?: readonly string[];
    hardDeny?: readonly string[];
  },
  toolSetRegistry: ToolSetRegistry,
): ResolvedCapabilityPolicy {
  const allow = new Set(expandToolSets(input.entityAllowed, toolSetRegistry));
  const deniedRaw = [
    ...input.entityDenied,
    ...(input.skillDenies ?? []),
    ...(input.callExtraDenied ?? []),
    ...POLICY_RUN_HARD_DENIED_TOOLS,
    ...(input.hardDeny ?? []),
  ];
  const denied = new Set(expandToolSets(deniedRaw, toolSetRegistry));
  for (const name of denied) {
    allow.delete(name);
  }
  return {
    allowed_tools: [...allow].toSorted(),
    denied_tools: [...denied].toSorted(),
  };
}

/** 从任意 policy 片段物化（cron / skill-review 等）；结果已含 HARD_DENY */
export function materializeFromFragments(
  fragments: readonly CapabilityPolicyFragment[],
  toolSetRegistry: ToolSetRegistry,
  extraHardDeny: readonly string[] = [],
): { policy: ResolvedCapabilityPolicy; toolNames: string[] } {
  const allowedRaw: string[] = [];
  const deniedRaw: string[] = [...POLICY_RUN_HARD_DENIED_TOOLS, ...extraHardDeny];
  for (const frag of fragments) {
    allowedRaw.push(...frag.allowed_tools);
    deniedRaw.push(...frag.denied_tools);
  }
  const allow = new Set(expandToolSets(allowedRaw, toolSetRegistry));
  const denied = new Set(expandToolSets(deniedRaw, toolSetRegistry));
  for (const name of denied) {
    allow.delete(name);
  }
  const policy: ResolvedCapabilityPolicy = {
    allowed_tools: [...allow].toSorted(),
    denied_tools: [...denied].toSorted(),
  };
  return { policy, toolNames: [...policy.allowed_tools] };
}
