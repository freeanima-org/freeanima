import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RESIDENT_TOP_N } from "@freeanima/core/repos";

import { getSemanticMemoryStore } from "./semantic-port.ts";
import { formatResidentMemoryLine } from "./memory-reference.ts";

const MAX_AGENTS_CHARS = 8000;
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

function readAgents(cwd: string | null | undefined): string {
  if (!cwd) return "";
  const agentsPath = join(cwd, "AGENTS.md");
  if (!existsSync(agentsPath)) return "";
  try {
    let content = readFileSync(agentsPath, "utf-8").trim();
    if (!content) return "";
    if (content.length > MAX_AGENTS_CHARS) {
      const head = content.slice(0, Math.floor(MAX_AGENTS_CHARS * 0.7));
      const tail = content.slice(-Math.floor(MAX_AGENTS_CHARS * 0.2));
      content = `${head}\n\n[... truncated ...]\n\n${tail}`;
    }
    return wrapPromptSection("Project context", content);
  } catch {
    return "";
  }
}

async function renderResidentMemory(): Promise<string> {
  const facts = await getSemanticMemoryStore().listResident(RESIDENT_TOP_N);
  if (!facts.length) return "";
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
): Promise<SystemPromptParts> {
  return {
    self: selfContent.trim(),
    agents: readAgents(cwd),
    resident: await renderResidentMemory(),
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
