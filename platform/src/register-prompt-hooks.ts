import type { HookRegistry } from "@freeanima/kernel/hooks";
import { systemPromptBuild } from "@freeanima/core/hooks/prompt";
import { registerToolsetSystemPromptHooks } from "@freeanima/capabilities-tools/toolset-prompt-hooks";
import { buildMemorySystemPromptSections } from "@freeanima/capabilities-memory/system-prompt-sections";
import { loadSelfLayerPrompt } from "@freeanima/capabilities-identity";
import type { ToolSetRegistry } from "@freeanima/core/tool";

function describePlatform(platform?: string): string {
  if (!platform) return "未知通道";
  if (platform === "cron") return "定时任务 (Cron)";
  if (platform === "discord") return "Discord";
  if (platform === "weixin") return "微信";
  if (platform.startsWith("sap:chat:")) return "网页聊天 (Chat)";
  if (platform.startsWith("sap:companion:")) return "桌面伴侣";
  if (platform.startsWith("sap:pairprogramming:")) return "结对编程 (Pair Programming)";
  if (platform.startsWith("sap:")) {
    const app = platform.split(":")[1] ?? "unknown";
    return `SAP 卫星 (${app})`;
  }
  return platform;
}

export function registerMemorySystemPromptHooks(registry: HookRegistry): void {
  registry.on(systemPromptBuild, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const sections = await buildMemorySystemPromptSections(selfContent, ctx.cwd);
    if (!sections.length) return { status: "ok" };
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

export function registerSystemPromptHooks(opts: {
  hookRegistry: HookRegistry;
  getToolRegistry: () => ToolSetRegistry;
}): void {
  registerMemorySystemPromptHooks(opts.hookRegistry);
  registerToolsetSystemPromptHooks(opts.hookRegistry, opts.getToolRegistry);
  registerChannelSystemPromptHook(opts.hookRegistry);
}
