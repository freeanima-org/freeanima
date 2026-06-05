import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getStore } from "./store.ts";

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

function renderResidentMemory(): string {
  const facts = getStore().resident(20);
  if (!facts.length) return "";
  const lines = facts.map((f) => `- ${f.content}`);
  return `## 常驻记忆\n${lines.join("\n")}`;
}

export type SystemPromptParts = {
  soul: string;
  agents: string;
  resident: string;
  skills: string;
};

/** soul / agents / resident；skills 由 core 注入 engine.getActiveSkillsContent */
export function decomposeSystemPromptParts(
  soulContent: string,
  cwd?: string | null,
  skills = "",
): SystemPromptParts {
  return {
    soul: soulContent.trim(),
    agents: readAgents(cwd),
    resident: renderResidentMemory(),
    skills: skills.trim(),
  };
}

export function composeSystemPrompt(parts: SystemPromptParts): string {
  const chunks: string[] = [];
  if (parts.soul) chunks.push(parts.soul);
  if (parts.agents) chunks.push(parts.agents);
  if (parts.resident) chunks.push(parts.resident);
  if (parts.skills) chunks.push(parts.skills);
  return chunks.join("\n\n");
}
