import type { Context } from "cordis";
import { onSystemPromptBuild } from "@freeanima/habitat/core/hooks/cordis";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import { isCodingConversationMeta } from "@freeanima/habitat/core/tool";
import { registerToolsetSystemPromptHooks } from "@freeanima/habitat/capabilities/tools/toolset-prompt-hooks";
import { registerWorldContextSystemPromptHook } from "@freeanima/habitat/capabilities/tools/world-prompt-hooks";
import { registerSkillsCatalogSystemPromptHook } from "@freeanima/habitat/capabilities/tools/skills-prompt-hooks";
import { ANIMA_URI_PROTOCOL_BODY } from "@freeanima/habitat/capabilities/tools/anima-uri-prompt";
import { registerSubagentCatalogSystemPromptHook } from "@freeanima/features/subagent/domain";
import { registerCodingProjectContextPromptHook } from "@freeanima/features/coding/domain/project-context-prompt-hooks.ts";
import { registerRoomProtocolSystemPromptHook } from "@freeanima/features/room/domain/room-protocol-prompt-hooks.ts";
import { buildMemorySystemPromptSections } from "@freeanima/habitat/capabilities/memory/system-prompt-sections";
import { loadSelfLayerInner } from "@freeanima/habitat/capabilities/self";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import type { SkillRegistry } from "@freeanima/habitat/core/skill";

function describePlatform(platform?: string): string {
  if (!platform) return "未知通道";
  if (platform === "discord") return "Discord";
  if (platform === "weixin") return "微信";
  if (platform === "chat") return "网页聊天 (Chat)";
  if (platform === "coding") return "编码工作台";
  if (platform === "companion") return "桌面伴侣";
  return platform;
}

export function registerMemorySystemPromptHooks(ctx: Context): void {
  onSystemPromptBuild(ctx, async (event) => {
    const agentId = event.meta?.agent_subject_id;
    let worldId: number | undefined;
    if (agentId != null && agentId > 0) {
      try {
        const { assertBindableAgentSubject } =
          await import("@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts");
        worldId = (await assertBindableAgentSubject(agentId)).agent_world_id;
      } catch {
        worldId = undefined;
      }
    }
    const selfContent =
      event.mode === "work" || agentId == null ? "" : await loadSelfLayerInner(agentId);
    const sections = await buildMemorySystemPromptSections(
      selfContent,
      event.cwd,
      event.mode,
      worldId != null ? { world_id: worldId } : undefined,
      { skipMemoryRules: isCodingConversationMeta(event.meta) },
    );
    if (sections.length === 0) return undefined;
    return { sections };
  });
}

export function registerAnimaUriProtocolSystemPromptHook(ctx: Context): void {
  onSystemPromptBuild(ctx, (event) => {
    if (isCodingConversationMeta(event.meta)) return undefined;
    return {
      sections: [
        {
          id: "anima-uri-protocol",
          content: ANIMA_URI_PROTOCOL_BODY,
          order: 24,
          priority: 1,
          budgetChars: 500,
          xmlTag: PROMPT_XML_TAGS.animaUri,
        },
      ],
    };
  });
}

export function registerChannelSystemPromptHook(ctx: Context): void {
  onSystemPromptBuild(ctx, (event) => {
    const platform = event.meta?.platform;
    const desc = describePlatform(platform);
    const modeLabel = event.mode === "work" ? "工作模式" : "数字人类模式";
    const channelBody = isCodingConversationMeta(event.meta)
      ? "编码工作台（coding）"
      : `对话通道（${modeLabel}）\n当前通道：${desc}`;
    return {
      sections: [
        {
          id: "channel",
          content: channelBody,
          order: 5,
          priority: 2,
          xmlTag: PROMPT_XML_TAGS.channel,
        },
      ],
    };
  });
}

export function registerEnvHealthSystemPromptHook(ctx: Context): void {
  onSystemPromptBuild(ctx, async (event) => {
    if (event.mode === "work") return undefined;
    const { buildEnvHealthPromptBody } = await import("./service/env-health/prompt.ts");
    const { ENV_HEALTH_PROMPT_FRAME } = await import("./service/env-health/format.ts");
    try {
      const content = await buildEnvHealthPromptBody();
      if (!content.trim()) return undefined;
      return {
        sections: [
          {
            id: "env-health-baseline",
            content,
            order: 15,
            priority: 8,
            budgetChars: 1_200,
            xmlTag: PROMPT_XML_TAGS.envHealth,
            xmlFrame: ENV_HEALTH_PROMPT_FRAME,
          },
        ],
      };
    } catch {
      return undefined;
    }
  });
}

export function registerUserActivityStatsSystemPromptHook(ctx: Context): void {
  onSystemPromptBuild(ctx, async (event) => {
    if (event.mode === "work") return undefined;
    const { buildUserActivityStatsPromptBody } =
      await import("./service/user-activity-stats/prompt.ts");
    const { USER_ACTIVITY_PROMPT_FRAME } = await import("./service/user-activity-stats/format.ts");
    try {
      const content = await buildUserActivityStatsPromptBody();
      if (!content.trim()) return undefined;
      return {
        sections: [
          {
            id: "user-activity-stats",
            content,
            order: 16,
            priority: 9,
            budgetChars: 800,
            xmlTag: PROMPT_XML_TAGS.userActivity,
            xmlFrame: USER_ACTIVITY_PROMPT_FRAME,
          },
        ],
      };
    } catch {
      return undefined;
    }
  });
}

export function registerTemporalSummarySystemPromptHook(ctx: Context): void {
  onSystemPromptBuild(ctx, async (event) => {
    if (event.mode === "work") return undefined;
    const agentId = event.meta?.agent_subject_id;
    if (agentId == null || agentId <= 0) return undefined;
    try {
      const { assertBindableAgentSubject } =
        await import("@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts");
      const { getActiveRuntimeConfig } = await import("@freeanima/habitat/core/config");
      const { buildTemporalSummarySystemBody, resolveTemporalSummaryConfig } =
        await import("@freeanima/habitat/capabilities/memory/temporal-summary");
      const { cacheGetJson, cacheSetJson } = await import("@freeanima/habitat/core/redis");
      const bound = await assertBindableAgentSubject(agentId);
      const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
      // 只读 Redis sys_roll；miss 跳过，不在拼装路径打 LLM
      const { body, truncated } = await buildTemporalSummarySystemBody(config, {
        world_id: bound.agent_world_id,
        peerCache: {
          getJson: cacheGetJson,
          setJson: cacheSetJson,
        },
      });
      if (truncated) {
        const { notifyTemporalSummarySystemTruncated } =
          await import("./service/temporal-summary-truncate-notify.ts");
        await notifyTemporalSummarySystemTruncated({ maxChars: config.system_prompt_max_chars });
      }
      if (!body.trim()) return undefined;
      return {
        sections: [
          {
            id: "temporal-summary",
            content: body,
            order: 20,
            priority: 6,
            budgetChars: config.system_prompt_max_chars,
            xmlTag: PROMPT_XML_TAGS.temporalSummary,
          },
        ],
      };
    } catch (e) {
      const { cstDaySourceRef, notifySoftFailure } =
        await import("@freeanima/habitat/core/soft-failure");
      void notifySoftFailure({
        sourceRef: cstDaySourceRef("temporal_summary:inject_failed"),
        title: "时间摘要注入失败",
        body: [
          "本轮组装 system prompt 时时间摘要段落失败，已跳过该段继续推理。",
          `错误：${e instanceof Error ? e.message : String(e)}`,
        ].join("\n"),
        payload: {
          kind: "temporal_summary_inject_failed",
          error: e instanceof Error ? e.message : String(e),
        },
        logLabel: "temporal_summary_inject",
      });
      return undefined;
    }
  });
}

export function registerSystemPromptHooks(opts: {
  ctx: Context;
  getToolRegistry: () => ToolSetRegistry;
  getSkillRegistry?: () => SkillRegistry;
}): void {
  registerMemorySystemPromptHooks(opts.ctx);
  registerCodingProjectContextPromptHook(opts.ctx);
  registerRoomProtocolSystemPromptHook(opts.ctx);
  registerWorldContextSystemPromptHook(opts.ctx);
  registerToolsetSystemPromptHooks(opts.ctx, opts.getToolRegistry);
  registerSubagentCatalogSystemPromptHook(opts.ctx);
  if (opts.getSkillRegistry) {
    registerSkillsCatalogSystemPromptHook(opts.ctx, opts.getSkillRegistry);
  }
  registerChannelSystemPromptHook(opts.ctx);
  registerAnimaUriProtocolSystemPromptHook(opts.ctx);
  registerEnvHealthSystemPromptHook(opts.ctx);
  registerUserActivityStatsSystemPromptHook(opts.ctx);
  registerTemporalSummarySystemPromptHook(opts.ctx);
}
