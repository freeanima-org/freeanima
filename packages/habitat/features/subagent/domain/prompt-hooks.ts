import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import {
  entityMatchesScenarioCatalog,
  PROMPT_XML_TAGS,
  resolveCodingCatalogTagId,
  systemPromptBuild,
} from "@freeanima/habitat/core/hooks/prompt";
import { isCodingConversationMeta } from "@freeanima/habitat/core/tool";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config";

import { listSubagents } from "./subagent-store.ts";
import type { SubagentRow } from "./types.ts";

const SUBAGENTS_BODY_PREFIX =
  "For multi-step tool loops: prefer a **Subagent** first; otherwise load related **skills** and follow their workflows; freely explore **toolsets** only as a last resort.\n\n" +
  "Named in-process subagent profiles. Dispatch with `subagent_run` (slug|id), or ephemeral (`instructions` + `allowed_tools`). Results return as the tool payload.\n\n" +
  "单任务用 `goal`，不要用 `tasks` 包一层；`tasks` 仅并行。临时必须 `instructions`（角色）+ `goal` + `allowed_tools`。";

const CODING_SUBAGENTS_BODY_PREFIX =
  "编码会话可用 Subagent（`subagent_run` slug|id）。只读探索工作区优先 **coding-explorer**（前哨 file_list / file_read / file_search）。";

/** 供单测 / 复用：具名档案目录正文（含策略说明；fold 外包 `<subagents>`） */
export function formatSubagentCatalogContent(
  rows: readonly SubagentRow[],
  opts?: { coding?: boolean },
): string {
  if (rows.length === 0) return "";
  const lines = rows.map((r) => {
    const desc = r.summary.trim() || r.title.trim() || "(no description)";
    return `- **${r.slug}**: ${desc}`;
  });
  const prefix = opts?.coding ? CODING_SUBAGENTS_BODY_PREFIX : SUBAGENTS_BODY_PREFIX;
  return `${prefix}\n\n${lines.join("\n")}`;
}

/** Progressive disclosure：系统提示注入 slug + summary；置于 skills 目录之前（仅 conversation） */
export function registerSubagentCatalogSystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    async (ctx) => {
      try {
        const worldId = getResolvedWorldContext().agent_world_id;
        const scenario = ctx.meta?.scenario;
        const codingTagId = await resolveCodingCatalogTagId(worldId);
        const rows = (await listSubagents(worldId)).filter((row) =>
          entityMatchesScenarioCatalog(row.tag_ids, codingTagId, scenario),
        );
        const content = formatSubagentCatalogContent(rows, {
          coding: isCodingConversationMeta(ctx.meta),
        });
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
