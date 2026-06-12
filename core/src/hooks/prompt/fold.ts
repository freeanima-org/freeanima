import { walkHookChainOldestFirst, type HookStepLink } from "@freeanima/kernel/hooks";
import type { SystemPromptBuildEffect, SystemPromptSection } from "./hooks.ts";

export function foldSystemPromptSections(
  chain: HookStepLink<SystemPromptBuildEffect> | null,
): string {
  const byId = new Map<string, SystemPromptSection>();
  for (const step of walkHookChainOldestFirst(chain)) {
    if (step.status !== "ok" || !step.data?.sections?.length) continue;
    for (const section of step.data.sections) {
      byId.set(section.id, section);
    }
  }
  return [...byId.values()]
    .filter((s) => s.content.trim())
    .toSorted((a, b) => a.order - b.order)
    .map((s) => s.content.trim())
    .join("\n\n");
}
