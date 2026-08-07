import { RESIDENT_TOP_N } from "@freeanima/host/core/db/pg/semantic-memory/types";
import { listResidentSemanticMemory } from "@freeanima/host/core/db/pg/semantic-memory";

import { formatResidentMemoryLine } from "./memory-reference.ts";

const PROMPT_CODE_FENCE_LANG = "md";

/** Outer second-person frame for the resident-memory system prompt segment */
export const RESIDENT_MEMORY_SYSTEM_FRAME =
  "Below is your resident memory. These facts and conventions must always travel with you; follow and apply them consciously in conversation.";

function wrapPromptSection(heading: string, inner: string, frame?: string): string {
  const body = inner.trim();
  if (!body) return "";
  const header = frame ? `${frame.trim()}\n\n## ${heading}` : `## ${heading}`;
  return `${header}\n\`\`\`${PROMPT_CODE_FENCE_LANG}\n${body}\n\`\`\``;
}

function readAgents(_cwd: string | null | undefined): string {
  // 项目 AGENTS.md / rules 仅 Coding 模块经 Outpost sync 注入；见 coding project-context hooks。
  return "";
}

async function renderResidentMemory(): Promise<string> {
  const facts = await listResidentSemanticMemory(RESIDENT_TOP_N);
  if (facts.length === 0) return "";
  const lines = facts.map((f) => formatResidentMemoryLine(f.content, f.id, f.pinned));
  return wrapPromptSection("Resident memory", lines.join("\n"), RESIDENT_MEMORY_SYSTEM_FRAME);
}

export type SystemPromptParts = {
  self: string;
  agents: string;
  resident: string;
  toolsets: string;
};

/** self / agents / resident; skills are injected via load_skill tool messages, not system prompt */
export async function decomposeSystemPromptParts(
  selfContent: string,
  cwd?: string | null,
  opts?: { includeResident?: boolean },
): Promise<SystemPromptParts> {
  return {
    self: selfContent.trim(),
    agents: readAgents(cwd),
    resident: opts?.includeResident === false ? "" : await renderResidentMemory(),
    toolsets: "",
  };
}

export function composeSystemPrompt(parts: SystemPromptParts): string {
  const chunks: string[] = [];
  if (parts.self) chunks.push(parts.self);
  if (parts.resident) chunks.push(parts.resident);
  if (parts.agents) chunks.push(parts.agents);
  return chunks.join("\n\n");
}
