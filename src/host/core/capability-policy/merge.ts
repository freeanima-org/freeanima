import type { CapabilityPolicyFragment, ResolvedCapabilityPolicy } from "./types.ts";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { expandToolSets } from "./expand.ts";

/** 多片段合并：allow 并集 − deny 并集（deny 胜出） */
export function mergePolicyFragments(
  fragments: readonly CapabilityPolicyFragment[],
  toolSetRegistry: ToolSetRegistry,
): ResolvedCapabilityPolicy {
  const allowedRaw: string[] = [];
  const deniedRaw: string[] = [];

  for (const frag of fragments) {
    allowedRaw.push(...frag.allowed_tools);
    deniedRaw.push(...frag.denied_tools);
  }

  const allowedExpanded = new Set(expandToolSets(allowedRaw, toolSetRegistry));
  const deniedExpanded = new Set(expandToolSets(deniedRaw, toolSetRegistry));
  for (const name of deniedExpanded) {
    allowedExpanded.delete(name);
  }

  return {
    allowed_tools: [...allowedExpanded].toSorted(),
    denied_tools: [...deniedExpanded].toSorted(),
  };
}
