import type { HookRegistry } from "@freeanima/kernel/hooks";
import { systemPromptBuild } from "@freeanima/core/hooks/prompt";
import { getResolvedWorldContext } from "@freeanima/core/config/world-context";

export function registerWorldContextSystemPromptHook(registry: HookRegistry): void {
  registry.on(systemPromptBuild, () => {
    let ctx;
    try {
      ctx = getResolvedWorldContext();
    } catch {
      return { status: "ok" };
    }
    const content =
      "## 实体 World 上下文\n" +
      "对话 LLM 工具默认在 **agent 专属 private world**（`agent_subject_id` → `default_private_world_id`）操作；多数 task/tasklist/entity 工具可省略 `world_id`。\n" +
      "按 `id` 或 `list_id` 操作时只需传 id，world 从实体反查。邮件账户等仍属 agent 侧资源。\n\n" +
      `- agent_subject_id: ${ctx.agent_subject_id}\n` +
      `- agent_world_id: ${ctx.agent_world_id}\n` +
      `- user_subject_id: ${ctx.user_subject_id}（Shell/SAP 用户侧切换用，非 LLM tool 默认 scope）\n` +
      `- user_world_id: ${ctx.user_world_id}`;
    return {
      status: "ok",
      data: {
        sections: [{ id: "world-context", content, order: 4 }],
      },
    };
  });
}
