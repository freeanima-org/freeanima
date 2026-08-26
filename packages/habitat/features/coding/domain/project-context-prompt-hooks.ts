/**
 * Coding 模块：把 Outpost sync 的项目 Agent 上下文注入 system prompt。
 * 非 coding 会话不加载。
 */

import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import {
  PROMPT_XML_TAGS,
  systemPromptBuild,
  type SystemPromptSection,
} from "@freeanima/habitat/core/hooks/prompt";
import {
  formatAlwaysRulesSection,
  formatRequestableRulesCatalog,
  type ProjectAgentContextSnapshot,
} from "@freeanima/shared/coding/project-agent-context";
import { getProjectAgentContext } from "@freeanima/shared/coding/project-context-cache.ts";
import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";
import { asRecord } from "@freeanima/shared/util";

function asSnapshot(raw: unknown): ProjectAgentContextSnapshot | null {
  const o = asRecord(raw);
  if (!o) return null;
  if (!Array.isArray(o.rules) || !Array.isArray(o.skills)) return null;
  return assertNarrow<ProjectAgentContextSnapshot>(raw);
}

function conversationIdFromMeta(meta: unknown): string | null {
  const o = asRecord(meta);
  if (!o) return null;
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
      if (ctx.mode !== "work" && ctx.meta?.scenario !== "coding_agent") {
        return { status: "ok" };
      }
      if (ctx.meta?.scenario !== "coding_agent") {
        return { status: "ok" };
      }

      const sid = conversationIdFromMeta(ctx.meta);

      // meta 上也可能直接挂 snapshot（测试）
      const metaRec = asRecord(ctx.meta);
      let snapshot = asSnapshot(metaRec?.project_agent_context) ?? null;
      if (!snapshot && sid) snapshot = getProjectAgentContext(sid) ?? null;
      if (!snapshot) return { status: "ok" };

      const rules = snapshot.rules;

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

      if (sections.length === 0) return { status: "ok" };
      return { status: "ok", data: { sections } };
    },
    { llm_kind: "conversation" },
  );
}
