import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import { PROMPT_XML_TAGS, systemPromptBuild } from "@freeanima/habitat/core/hooks/prompt";
import { registerToolsetSystemPromptHooks } from "@freeanima/habitat/capabilities/tools/toolset-prompt-hooks";
import { registerWorldContextSystemPromptHook } from "@freeanima/habitat/capabilities/tools/world-prompt-hooks";
import { registerSkillsCatalogSystemPromptHook } from "@freeanima/habitat/capabilities/tools/skills-prompt-hooks";
import { ANIMA_URI_PROTOCOL_BODY } from "@freeanima/habitat/capabilities/tools/anima-uri-prompt";
import { registerSubagentCatalogSystemPromptHook } from "@freeanima/features/subagent/domain";
import { registerCodingProjectContextPromptHook } from "@freeanima/features/coding/domain/project-context-prompt-hooks.ts";
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

export function registerMemorySystemPromptHooks(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    async (ctx) => {
      const agentId = ctx.meta?.agent_subject_id;
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
        ctx.mode === "work" || agentId == null ? "" : await loadSelfLayerInner(agentId);
      const sections = await buildMemorySystemPromptSections(
        selfContent,
        ctx.cwd,
        ctx.mode,
        worldId != null ? { world_id: worldId } : undefined,
      );
      if (sections.length === 0) return { status: "ok" };
      return { status: "ok", data: { sections } };
    },
    { llm_kind: "conversation" },
  );
}

export function registerAnimaUriProtocolSystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    () => ({
      status: "ok",
      data: {
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
      },
    }),
    { llm_kind: "conversation" },
  );
}

export function registerChannelSystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    (ctx) => {
      const platform = ctx.meta?.platform;
      const desc = describePlatform(platform);
      const modeLabel = ctx.mode === "work" ? "工作模式" : "数字人类模式";
      return {
        status: "ok",
        data: {
          sections: [
            {
              id: "channel",
              content: `对话通道（${modeLabel}）\n当前通道：${desc}`,
              order: 5,
              priority: 2,
              xmlTag: PROMPT_XML_TAGS.channel,
            },
          ],
        },
      };
    },
    { llm_kind: "conversation" },
  );
}

export function registerEnvHealthSystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    async (ctx) => {
      if (ctx.mode === "work") return { status: "ok" };
      const { buildEnvHealthPromptBody } = await import("./service/env-health/prompt.ts");
      const { ENV_HEALTH_PROMPT_FRAME } = await import("./service/env-health/format.ts");
      try {
        const content = await buildEnvHealthPromptBody();
        if (!content.trim()) return { status: "ok" };
        return {
          status: "ok",
          data: {
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
          },
        };
      } catch {
        return { status: "ok" };
      }
    },
    { llm_kind: "conversation" },
  );
}

export function registerUserActivityStatsSystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    async (ctx) => {
      if (ctx.mode === "work") return { status: "ok" };
      const { buildUserActivityStatsPromptBody } =
        await import("./service/user-activity-stats/prompt.ts");
      const { USER_ACTIVITY_PROMPT_FRAME } =
        await import("./service/user-activity-stats/format.ts");
      try {
        const content = await buildUserActivityStatsPromptBody();
        if (!content.trim()) return { status: "ok" };
        return {
          status: "ok",
          data: {
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
          },
        };
      } catch {
        return { status: "ok" };
      }
    },
    { llm_kind: "conversation" },
  );
}

export function registerTemporalSummarySystemPromptHook(registry: HookRegistry): void {
  registry.on(
    systemPromptBuild,
    async (ctx) => {
      if (ctx.mode === "work") return { status: "ok" };
      const agentId = ctx.meta?.agent_subject_id;
      if (agentId == null || agentId <= 0) return { status: "ok" };
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
        if (!body.trim()) return { status: "ok" };
        return {
          status: "ok",
          data: {
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
          },
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
        return { status: "ok" };
      }
    },
    { llm_kind: "conversation" },
  );
}

export function registerSystemPromptHooks(opts: {
  hookRegistry: HookRegistry;
  getToolRegistry: () => ToolSetRegistry;
  getSkillRegistry?: () => SkillRegistry;
}): void {
  registerMemorySystemPromptHooks(opts.hookRegistry);
  registerCodingProjectContextPromptHook(opts.hookRegistry);
  registerWorldContextSystemPromptHook(opts.hookRegistry);
  registerToolsetSystemPromptHooks(opts.hookRegistry, opts.getToolRegistry);
  registerSubagentCatalogSystemPromptHook(opts.hookRegistry);
  if (opts.getSkillRegistry) {
    registerSkillsCatalogSystemPromptHook(opts.hookRegistry, opts.getSkillRegistry);
  }
  registerChannelSystemPromptHook(opts.hookRegistry);
  registerAnimaUriProtocolSystemPromptHook(opts.hookRegistry);
  registerEnvHealthSystemPromptHook(opts.hookRegistry);
  registerUserActivityStatsSystemPromptHook(opts.hookRegistry);
  registerTemporalSummarySystemPromptHook(opts.hookRegistry);
}
