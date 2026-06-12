import { decomposeSystemPromptParts } from "./system-prompt.ts";

export type MemorySystemPromptSection = {
  id: string;
  content: string;
  order: number;
};

/** Build self / resident / agents sections for systemPromptBuild hook */
export async function buildMemorySystemPromptSections(
  selfContent: string,
  cwd?: string | null,
): Promise<MemorySystemPromptSection[]> {
  const parts = await decomposeSystemPromptParts(selfContent, cwd);
  const sections: MemorySystemPromptSection[] = [];
  if (parts.self.trim()) {
    sections.push({ id: "self", content: parts.self.trim(), order: 0 });
  }
  if (parts.resident.trim()) {
    sections.push({ id: "resident", content: parts.resident, order: 30 });
  }
  if (parts.agents.trim()) {
    sections.push({ id: "agents", content: parts.agents, order: 40 });
  }
  return sections;
}
