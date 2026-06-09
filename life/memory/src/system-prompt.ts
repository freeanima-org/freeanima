import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getSemanticMemoryStore } from "./semantic-port.ts";
import { formatResidentMemoryLine, MEMORY_REFERENCE_CITATION_RULE } from "./memory-reference.ts";

const MAX_AGENTS_CHARS = 8000;
const PROMPT_CODE_FENCE_LANG = "md";

/** system prompt 常驻记忆段外层第二人称骨架 */
export const RESIDENT_MEMORY_SYSTEM_FRAME = `以下是你的常驻记忆。这些事实与约定需要你始终携带，你必须遵守并在对话中自觉运用。\n${MEMORY_REFERENCE_CITATION_RULE}`;

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
      content = `${head}\n\n[... 已截断 ...]\n\n${tail}`;
    }
    return wrapPromptSection("项目上下文", content);
  } catch {
    return "";
  }
}

async function renderResidentMemory(): Promise<string> {
  const facts = await getSemanticMemoryStore().listResident(20);
  if (!facts.length) return "";
  const lines = facts.map((f) => formatResidentMemoryLine(f.content, f.id, f.pinned));
  return wrapPromptSection("常驻记忆", lines.join("\n"), RESIDENT_MEMORY_SYSTEM_FRAME);
}

export type SystemPromptParts = {
  self: string;
  agents: string;
  resident: string;
};

/** self / agents / resident；技能通过 load_skill 工具消息注入，不写入 system prompt */
export async function decomposeSystemPromptParts(
  selfContent: string,
  cwd?: string | null,
): Promise<SystemPromptParts> {
  return {
    self: selfContent.trim(),
    agents: readAgents(cwd),
    resident: await renderResidentMemory(),
  };
}

export function composeSystemPrompt(parts: SystemPromptParts): string {
  const chunks: string[] = [];
  if (parts.self) chunks.push(parts.self);
  if (parts.resident) chunks.push(parts.resident);
  if (parts.agents) chunks.push(parts.agents);
  return chunks.join("\n\n");
}
