import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import { PROMPT_XML_TAGS, systemPromptBuild } from "@freeanima/habitat/core/hooks/prompt";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";

export function registerWorldContextSystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    () => {
      let ctx;
      try {
        ctx = getResolvedWorldContext();
      } catch {
        return { status: "ok" };
      }
      const content = [
        "对话 LLM 工具默认在 **agent 专属 private world**（`agent_subject_id` → `default_private_world_id`）操作；task/tasklist/entity/diary/email 等 toolset 多数调用可省略 `world_id`。",
        "按 `id` / `list_id` / `account_id` 操作时 world 从实体反查。通知工具用 `subject_id`（非 world_id）指定收件主体。",
        "",
        `- agent_subject_id: ${ctx.agent_subject_id}`,
        `- agent_world_id: ${ctx.agent_world_id}`,
        `- user_subject_id: ${ctx.user_subject_id}`,
        `- user_world_id: ${ctx.user_world_id}`,
        `- commons_world_id: ${ctx.commons_world_id}`,
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
              budgetChars: 1_200,
              xmlTag: PROMPT_XML_TAGS.worldContext,
            },
          ],
        },
      };
    },
    { llm_kind: "conversation" },
  );
}
