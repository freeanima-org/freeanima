import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { resolveCapabilityPolicy } from "./resolve.ts";
import type { ResolvedCapabilityPolicy } from "./types.ts";

/** 睡眠管线默认允许的记忆工具（原 sleep mask 硬编码列表） */
export const SLEEP_ALLOWED_TOOLS = [
  "memory_recall",
  "memory_semantic_search",
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_semantic_deprecate",
  "memory_semantic_merge",
  "memory_limbic_create",
  "memory_autobiographical_create",
  "memory_autobiographical_deprecate",
] as const;

export function resolveSleepPolicy(toolSetRegistry: ToolSetRegistry): ResolvedCapabilityPolicy {
  return resolveCapabilityPolicy(
    {
      caller: {
        allowed_tools: SLEEP_ALLOWED_TOOLS,
        denied_tools: [],
      },
    },
    toolSetRegistry,
  );
}
