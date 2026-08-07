/** 将 ProjectAgentContext 折成 system prompt 区块 */

import type { ProjectAgentContext, ProjectRule } from "./types.ts";

const MAX_ALWAYS_RULES_CHARS = 4_000;

function wrapFence(heading: string, body: string): string {
  const t = body.trim();
  if (!t) return "";
  return `## ${heading}\n\`\`\`md\n${t}\n\`\`\``;
}

/** always-on rules 拼接（按发现顺序）；超长截断 */
export function formatAlwaysRulesSection(rules: readonly ProjectRule[]): string {
  const always = rules.filter((r) => r.kind === "always");
  if (always.length === 0) return "";
  const chunks: string[] = [];
  let used = 0;
  for (const r of always) {
    const block = `### ${r.path}\n${r.content.trim()}`;
    if (used + block.length > MAX_ALWAYS_RULES_CHARS) {
      const remain = MAX_ALWAYS_RULES_CHARS - used;
      if (remain > 80) chunks.push(`${block.slice(0, remain)}\n\n[... truncated ...]`);
      break;
    }
    chunks.push(block);
    used += block.length + 2;
  }
  return wrapFence("Project context", chunks.join("\n\n"));
}

export function formatRequestableRulesCatalog(rules: readonly ProjectRule[]): string {
  const req = rules.filter((r) => r.kind === "requestable");
  if (req.length === 0) return "";
  const lines = req.map((r) => {
    const g = r.globs?.length ? ` (globs: ${r.globs.join(", ")})` : "";
    return `- \`${r.path}\`${g}`;
  });
  return ["## Project path-scoped rules", "Load via `file_read` when relevant:", ...lines].join(
    "\n",
  );
}

export function formatProjectSkillsCatalog(skills: ProjectAgentContext["skills"]): string {
  if (skills.length === 0) return "";
  const lines = skills.map((s) => `- **${s.name}**: ${s.description || "(no description)"}`);
  return [
    "## Project skills",
    "Repo-local techniques (use `skill_load` with the skill name):",
    ...lines,
  ].join("\n");
}

export function formatProjectAgentsCatalog(agents: ProjectAgentContext["agents"]): string {
  if (agents.length === 0) return "";
  const lines = agents.map((a) => `- **${a.slug}**: ${a.description || a.slug}`);
  return [
    "## Project subagents",
    "Repo-local agent profiles (dispatch with `subagent_run` slug):",
    ...lines,
  ].join("\n");
}

export function formatProjectMcpCatalog(mcp: ProjectAgentContext["mcpServers"]): string {
  if (mcp.length === 0) return "";
  const lines = mcp.map((m) => {
    const t = m.config.transport ?? (m.config.url ? "http" : "stdio");
    return `- **${m.name}** (${t}) from \`${m.path}\``;
  });
  return [
    "## Project MCP",
    "Managed by Coding Outpost; tools are bridged as remote tools when connected:",
    ...lines,
  ].join("\n");
}
