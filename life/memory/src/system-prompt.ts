import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getSemanticMemoryStore } from "./semantic-port.ts";

const MAX_AGENTS_CHARS = 8000;

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
    return `## 项目上下文\n${content}`;
  } catch {
    return "";
  }
}

async function renderResidentMemory(): Promise<string> {
  const facts = await getSemanticMemoryStore().listResident(20);
  if (!facts.length) return "";
  const lines = facts.map((f) => (f.pinned ? `- 📌 ${f.content}` : `- ${f.content}`));
  return `## 常驻记忆\n${lines.join("\n")}`;
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
  if (parts.agents) chunks.push(parts.agents);
  if (parts.resident) chunks.push(parts.resident);
  return chunks.join("\n\n");
}
