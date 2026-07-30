import type { HookRegistry } from "@freeanima/host/kernel/hooks";
import { systemPromptBuild } from "@freeanima/host/core/hooks/prompt";
import { getResolvedWorldContext } from "@freeanima/host/core/config";

import { listSubagents } from "./subagent-store.ts";
import type { SubagentRow } from "./types.ts";

/** 供单测 / 复用：具名档案目录正文（order 低于 skills-catalog） */
export function formatSubagentCatalogContent(rows: readonly SubagentRow[]): string {
  if (rows.length === 0) return "";
  const lines = rows.map((r) => {
    const desc = r.summary.trim() || r.title.trim() || "(no description)";
    return `- **${r.slug}**: ${desc}`;
  });
  return [
    "For multi-step tool loops: prefer a **Subagent** first; otherwise load related **skills** and follow their workflows; freely explore **toolsets** only as a last resort.",
    "",
    "## Subagents",
    "Named in-process subagent profiles. Dispatch with `subagent_run` (slug|id), or ephemeral (`instructions` + `allowed_tools`). Results return as the tool payload.",
    ...lines,
  ].join("\n");
}

/** Progressive disclosure：系统提示注入 slug + summary；置于 skills 目录之前（仅 conversation） */
export function registerSubagentCatalogSystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    async () => {
      try {
        const worldId = getResolvedWorldContext().agent_world_id;
        const rows = await listSubagents(worldId);
        const content = formatSubagentCatalogContent(rows);
        if (!content.trim()) return { status: "ok" };
        return {
          status: "ok",
          data: {
            sections: [
              { id: "subagents-catalog", content, order: 8, priority: 5, budgetChars: 2_000 },
            ],
          },
        };
      } catch {
        return { status: "ok" };
      }
    },
    { llm_kind: "conversation" },
  );
}
