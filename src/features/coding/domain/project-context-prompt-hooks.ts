/**
 * Coding 模块：把 Outpost sync 的项目 Agent 上下文注入 system prompt。
 * 非 coding 会话不加载。
 */

import type { HookRegistry } from "@freeanima/host/kernel/hooks";
import {
  PROMPT_XML_TAGS,
  systemPromptBuild,
  type SystemPromptSection,
} from "@freeanima/host/core/hooks/prompt";
import {
  formatAlwaysRulesSection,
  formatProjectAgentsCatalog,
  formatProjectMcpCatalog,
  formatProjectSkillsCatalog,
  formatRequestableRulesCatalog,
  getProjectAgentContext,
  type ProjectAgentContextSnapshot,
} from "@freeanima/features/coding/domain";

function asSnapshot(raw: unknown): ProjectAgentContextSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.rules) || !Array.isArray(o.skills)) return null;
  return raw as ProjectAgentContextSnapshot;
}

function conversationIdFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const o = meta as Record<string, unknown>;
  if (typeof o.conversation_id === "string" && o.conversation_id.trim()) {
    return o.conversation_id;
  }
  if (typeof o.id === "string" && o.id.trim()) return o.id;
  return null;
}

export function registerCodingProjectContextPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    (ctx) => {
      if (ctx.mode !== "work" && ctx.meta?.module !== "coding") {
        return { status: "ok" };
      }
      if (ctx.meta?.module !== "coding") {
        return { status: "ok" };
      }

      const sid = conversationIdFromMeta(ctx.meta);

      // meta 上也可能直接挂 snapshot（测试）
      let snapshot =
        asSnapshot(
          (ctx.meta as { project_agent_context?: unknown } | undefined)?.project_agent_context,
        ) ?? null;
      if (!snapshot && sid) snapshot = getProjectAgentContext(sid) ?? null;
      if (!snapshot) return { status: "ok" };

      const rules = snapshot.rules;
      const skills = snapshot.skills;
      const agents = snapshot.agents;
      const mcp = snapshot.mcpServers;

      const sections: SystemPromptSection[] = [];

      const always = formatAlwaysRulesSection(rules);
      if (always.trim()) {
        sections.push({
          id: "project-context",
          content: always,
          order: 40,
          priority: 7,
          budgetChars: 4_000,
          xmlTag: PROMPT_XML_TAGS.projectContext,
        });
      }
      const scoped = formatRequestableRulesCatalog(rules);
      if (scoped.trim()) {
        sections.push({
          id: "project-rules-scoped",
          content: scoped,
          order: 41,
          priority: 8,
          budgetChars: 1_200,
          xmlTag: PROMPT_XML_TAGS.projectRulesScoped,
        });
      }
      const skillCat = formatProjectSkillsCatalog(skills);
      if (skillCat.trim()) {
        sections.push({
          id: "project-skills-catalog",
          content: skillCat,
          order: 10,
          priority: 5,
          budgetChars: 2_000,
          xmlTag: PROMPT_XML_TAGS.projectSkills,
        });
      }
      const agentCat = formatProjectAgentsCatalog(agents);
      if (agentCat.trim()) {
        sections.push({
          id: "project-agents-catalog",
          content: agentCat,
          order: 11,
          priority: 5,
          budgetChars: 1_500,
          xmlTag: PROMPT_XML_TAGS.projectAgents,
        });
      }
      const mcpCat = formatProjectMcpCatalog(mcp);
      if (mcpCat.trim()) {
        sections.push({
          id: "project-mcp-catalog",
          content: mcpCat,
          order: 42,
          priority: 9,
          budgetChars: 1_000,
          xmlTag: PROMPT_XML_TAGS.projectMcp,
        });
      }

      if (sections.length === 0) return { status: "ok" };
      return { status: "ok", data: { sections } };
    },
    { llm_kind: "conversation" },
  );
}
