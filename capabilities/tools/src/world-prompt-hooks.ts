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
      "任务、清单等用户侧实体操作请使用 `user_world_id`；邮件账户等 Agent 侧资源使用 `agent_world_id`。\n\n" +
      `- user_subject_id: ${ctx.user_subject_id}\n` +
      `- agent_subject_id: ${ctx.agent_subject_id}\n` +
      `- user_world_id: ${ctx.user_world_id}\n` +
      `- agent_world_id: ${ctx.agent_world_id}`;
    return {
      status: "ok",
      data: {
        sections: [{ id: "world-context", content, order: 4 }],
      },
    };
  });
}
