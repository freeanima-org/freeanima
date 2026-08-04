import { decomposeSystemPromptParts } from "./system-prompt.ts";
import { MEMORY_RECALL_STRATEGY_RULE, MEMORY_REFERENCE_CITATION_RULE } from "./memory-reference.ts";
import type { SystemPromptSection } from "@freeanima/host/core/hooks/prompt";

/** Build self / resident / agents sections for systemPromptBuild hook */
export async function buildMemorySystemPromptSections(
  selfContent: string,
  cwd?: string | null,
): Promise<SystemPromptSection[]> {
  const parts = await decomposeSystemPromptParts(selfContent, cwd);
  const sections: SystemPromptSection[] = [];
  if (parts.self.trim()) {
    sections.push({ id: "self", content: parts.self.trim(), order: 0, priority: 0 });
  }
  sections.push({
    id: "memory-citation",
    content: MEMORY_REFERENCE_CITATION_RULE,
    order: 25,
    priority: 1,
  });
  sections.push({
    id: "memory-recall",
    content: MEMORY_RECALL_STRATEGY_RULE,
    order: 26,
    priority: 1,
  });
  if (parts.resident.trim()) {
    sections.push({
      id: "resident",
      content: parts.resident,
      order: 30,
      priority: 4,
      budgetChars: 6_000,
    });
  }
  if (parts.agents.trim()) {
    sections.push({
      id: "agents",
      content: parts.agents,
      order: 40,
      priority: 7,
      budgetChars: 4_000,
    });
  }
  return sections;
}
