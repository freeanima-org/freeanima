import {
  decomposeSystemPromptParts,
  renderResidentMemoryBody,
  RESIDENT_MEMORY_SYSTEM_FRAME,
} from "./system-prompt.ts";
import { MEMORY_RECALL_STRATEGY_RULE, MEMORY_REFERENCE_CITATION_RULE } from "./memory-reference.ts";
import {
  PROMPT_XML_TAGS,
  type PromptMode,
  type SystemPromptSection,
} from "@freeanima/host/core/hooks/prompt";
import { SELF_LAYER_SYSTEM_FRAME } from "@freeanima/host/capabilities/self/blocks.ts";

/**
 * Build self / resident / agents sections for systemPromptBuild hook.
 * `selfContent` must be the *inner* nested-block XML (no outer `<self_layer>`).
 */
export async function buildMemorySystemPromptSections(
  selfContent: string,
  cwd?: string | null,
  mode: PromptMode = "digital_human",
): Promise<SystemPromptSection[]> {
  const includeDigitalHuman = mode !== "work";
  const parts = await decomposeSystemPromptParts(includeDigitalHuman ? selfContent : "", cwd, {
    includeResident: false,
  });
  const sections: SystemPromptSection[] = [];
  if (includeDigitalHuman && parts.self.trim()) {
    sections.push({
      id: "self",
      content: parts.self.trim(),
      order: 0,
      priority: 0,
      xmlTag: PROMPT_XML_TAGS.selfLayer,
      xmlFrame: SELF_LAYER_SYSTEM_FRAME,
    });
  }
  sections.push({
    id: "memory-citation",
    content: MEMORY_REFERENCE_CITATION_RULE,
    order: 25,
    priority: 1,
    xmlTag: PROMPT_XML_TAGS.memoryCitation,
  });
  sections.push({
    id: "memory-recall",
    content: MEMORY_RECALL_STRATEGY_RULE,
    order: 26,
    priority: 1,
    xmlTag: PROMPT_XML_TAGS.memoryRecall,
  });
  if (includeDigitalHuman) {
    const residentBody = await renderResidentMemoryBody();
    if (residentBody.trim()) {
      sections.push({
        id: "resident",
        content: residentBody,
        order: 30,
        priority: 4,
        budgetChars: 6_000,
        xmlTag: PROMPT_XML_TAGS.residentMemory,
        xmlFrame: RESIDENT_MEMORY_SYSTEM_FRAME,
      });
    }
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
