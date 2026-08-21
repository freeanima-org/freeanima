import {
  peekActiveRuntimeConfig,
  resolveMemoryResidentConfig,
} from "@freeanima/habitat/core/config";
import { listResidentSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";
import {
  PROMPT_XML_TAGS,
  RESIDENT_MEMORY_FIELDS,
  renderSemanticMemoryItem,
  toSemanticMemoryPromptItem,
  wrapPromptXmlSection,
} from "@freeanima/habitat/core/hooks/prompt";

/** Outer second-person frame for the resident-memory system prompt segment */
export const RESIDENT_MEMORY_SYSTEM_FRAME =
  "Below is your resident memory. These facts and conventions must always travel with you; follow and apply them consciously in conversation.";

function readAgents(_cwd: string | null | undefined): string {
  // 项目 AGENTS.md / rules 仅 Coding 模块经 Outpost sync 注入；见 coding project-context hooks。
  return "";
}

/** Inner resident-memory body (no XML wrap); fold wraps via xmlTag. */
export async function renderResidentMemoryBody(opts?: { world_id?: number }): Promise<string> {
  if (opts?.world_id == null || opts.world_id <= 0) return "";
  const { top_n } = resolveMemoryResidentConfig(peekActiveRuntimeConfig()?.data);
  const facts = await listResidentSemanticMemory(top_n, { world_id: opts.world_id });
  if (facts.length === 0) return "";
  return facts
    .map((f) =>
      renderSemanticMemoryItem(toSemanticMemoryPromptItem(f), { fields: RESIDENT_MEMORY_FIELDS }),
    )
    .filter(Boolean)
    .join("\n");
}

async function renderResidentMemory(opts?: { world_id?: number }): Promise<string> {
  const body = await renderResidentMemoryBody(opts);
  if (!body) return "";
  return wrapPromptXmlSection(PROMPT_XML_TAGS.residentMemory, body, {
    frame: RESIDENT_MEMORY_SYSTEM_FRAME,
  });
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
  opts?: { includeResident?: boolean; world_id?: number },
): Promise<SystemPromptParts> {
  return {
    self: selfContent.trim(),
    agents: readAgents(cwd),
    resident:
      opts?.includeResident === false
        ? ""
        : await renderResidentMemory(
            opts?.world_id != null ? { world_id: opts.world_id } : undefined,
          ),
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
