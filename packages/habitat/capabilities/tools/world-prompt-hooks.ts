import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import { PROMPT_XML_TAGS, systemPromptBuild } from "@freeanima/habitat/core/hooks/prompt";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg.ts";

export function registerWorldContextSystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    async (ctx) => {
      let userLine: string;
      let commonsLine: string;
      try {
        const world = getResolvedWorldContext();
        userLine = `- user subject_id=${world.user_subject_id} world_id=${world.user_world_id}`;
        commonsLine = `- commons_world_id=${world.commons_world_id}`;
      } catch {
        return { status: "ok" };
      }

      const currentAgentId = ctx.meta?.agent_subject_id;
      let currentLines: string[];
      if (currentAgentId == null || currentAgentId <= 0) {
        currentLines = ["- current agent: （本会话未绑定）"];
      } else {
        let title = `Agent ${currentAgentId}`;
        let worldId: string | number = "?";
        try {
          const row = await getEntity(currentAgentId);
          if (row?.title?.trim()) title = row.title.trim();
        } catch {
          /* keep fallback title */
        }
        try {
          worldId = await resolvePrivateWorldId(currentAgentId);
        } catch {
          /* keep "?" */
        }
        currentLines = [
          `- current agent subject_id=${currentAgentId} title=${JSON.stringify(title)} world_id=${worldId}`,
        ];
      }

      const content = [
        "World / Subject 作用域：工具省略 world_id/subject_id 时落在**当前会话 agent**的私有 World。",
        "操作其他主体必须显式传 subject_id 或 world_id。",
        "",
        "实例固定：",
        userLine,
        commonsLine,
        "",
        "当前会话：",
        ...currentLines,
      ].join("\n");

      return {
        status: "ok",
        data: {
          sections: [
            {
              id: "world-context",
              content,
              order: 4,
              priority: 3,
              budgetChars: 800,
              xmlTag: PROMPT_XML_TAGS.worldContext,
            },
          ],
        },
      };
    },
    { llm_kind: "conversation" },
  );
}
