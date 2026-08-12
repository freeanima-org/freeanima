import type { HookRegistry } from "@freeanima/host/kernel/hooks";
import { PROMPT_XML_TAGS, systemPromptBuild } from "@freeanima/host/core/hooks/prompt";
import { getResolvedWorldContext } from "@freeanima/host/core/config";

import { listSubagents } from "./subagent-store.ts";
import type { SubagentRow } from "./types.ts";

const SUBAGENTS_BODY_PREFIX =
  "For multi-step tool loops: prefer a **Subagent** first; otherwise load related **skills** and follow their workflows; freely explore **toolsets** only as a last resort.\n\n" +
  "Named in-process subagent profiles. Dispatch with `subagent_run` (slug|id), or ephemeral (`instructions` + `allowed_tools`). Results return as the tool payload.";

/** 供单测 / 复用：具名档案目录正文（含策略说明；fold 外包 `<subagents>`） */
export function formatSubagentCatalogContent(rows: readonly SubagentRow[]): string {
  if (rows.length === 0) return "";
  const lines = rows.map((r) => {
    const desc = r.summary.trim() || r.title.trim() || "(no description)";
    return `- **${r.slug}**: ${desc}`;
  });
  return `${SUBAGENTS_BODY_PREFIX}\n\n${lines.join("\n")}`;
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
              {
                id: "subagents-catalog",
                content,
                order: 8,
                priority: 5,
                budgetChars: 2_000,
                xmlTag: PROMPT_XML_TAGS.subagents,
              },
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
