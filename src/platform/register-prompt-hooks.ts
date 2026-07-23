import type { HookRegistry } from "@freeanima/kernel/hooks";
import { systemPromptBuild } from "@freeanima/core/hooks/prompt";
import { registerToolsetSystemPromptHooks } from "@freeanima/capabilities/tools/toolset-prompt-hooks";
import { registerWorldContextSystemPromptHook } from "@freeanima/capabilities/tools/world-prompt-hooks";
import { buildMemorySystemPromptSections } from "@freeanima/capabilities/memory/system-prompt-sections";
import { loadSelfLayerPrompt } from "@freeanima/capabilities/identity";
import type { ToolSetRegistry } from "@freeanima/core/tool";

function describePlatform(platform?: string): string {
  if (!platform) return "未知通道";
  if (platform === "cron") return "定时任务 (Cron)";
  if (platform === "discord") return "Discord";
  if (platform === "weixin") return "微信";
  if (platform === "chat") return "网页聊天 (Chat)";
  if (platform === "desktop" || platform === "mobile") return platform;
  if (platform.startsWith("remote:chat:")) {
    return "网页聊天 (Chat)";
  }
  if (platform.startsWith("remote:companion:")) {
    return "桌面伴侣";
  }
  if (platform.startsWith("remote:")) {
    const app = platform.split(":")[1] ?? "unknown";
    return `前哨 (${app})`;
  }
  return platform;
}

export function registerMemorySystemPromptHooks(registry: HookRegistry): void {
  registry.on(systemPromptBuild, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const sections = await buildMemorySystemPromptSections(selfContent, ctx.cwd);
    if (sections.length === 0) return { status: "ok" };
    return { status: "ok", data: { sections } };
  });
}

export function registerChannelSystemPromptHook(registry: HookRegistry): void {
  registry.on(systemPromptBuild, (ctx) => {
    const platform = ctx.meta?.platform;
    const desc = describePlatform(platform);
    return {
      status: "ok",
      data: {
        sections: [{ id: "channel", content: `## 对话通道\n当前通道：${desc}`, order: 5 }],
      },
    };
  });
}

export function registerEnvHealthSystemPromptHook(registry: HookRegistry): void {
  registry.on(systemPromptBuild, async () => {
    const { buildEnvHealthPromptSectionContent } = await import("./runtime/env-health/prompt.ts");
    try {
      const content = await buildEnvHealthPromptSectionContent();
      if (!content.trim()) return { status: "ok" };
      return {
        status: "ok",
        data: {
          sections: [{ id: "env-health-baseline", content, order: 15 }],
        },
      };
    } catch {
      return { status: "ok" };
    }
  });
}

export function registerUserActivityStatsSystemPromptHook(registry: HookRegistry): void {
  registry.on(systemPromptBuild, async () => {
    const { buildUserActivityStatsPromptSectionContent } =
      await import("./runtime/user-activity-stats/prompt.ts");
    try {
      const content = await buildUserActivityStatsPromptSectionContent();
      if (!content.trim()) return { status: "ok" };
      return {
        status: "ok",
        data: {
          sections: [{ id: "user-activity-stats", content, order: 16 }],
        },
      };
    } catch {
      return { status: "ok" };
    }
  });
}

export function registerTemporalSummarySystemPromptHook(registry: HookRegistry): void {
  registry.on(systemPromptBuild, async () => {
    try {
      const { getActiveRuntimeConfig } = await import("@freeanima/core/config");
      const { buildTemporalSummarySystemSection, resolveTemporalSummaryConfig } =
        await import("@freeanima/capabilities/memory/temporal-summary");
      const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
      const content = await buildTemporalSummarySystemSection(config);
      if (!content.trim()) return { status: "ok" };
      return {
        status: "ok",
        data: {
          sections: [{ id: "temporal-summary", content, order: 20 }],
        },
      };
    } catch {
      return { status: "ok" };
    }
  });
}

export function registerSystemPromptHooks(opts: {
  hookRegistry: HookRegistry;
  getToolRegistry: () => ToolSetRegistry;
}): void {
  registerMemorySystemPromptHooks(opts.hookRegistry);
  registerWorldContextSystemPromptHook(opts.hookRegistry);
  registerToolsetSystemPromptHooks(opts.hookRegistry, opts.getToolRegistry);
  registerChannelSystemPromptHook(opts.hookRegistry);
  registerEnvHealthSystemPromptHook(opts.hookRegistry);
  registerUserActivityStatsSystemPromptHook(opts.hookRegistry);
  registerTemporalSummarySystemPromptHook(opts.hookRegistry);
}
