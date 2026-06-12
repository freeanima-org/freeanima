import type { HookRegistry } from "@freeanima/kernel-hooks";
import { systemPromptBuild } from "@freeanima/engine-hooks/prompt";
import { registerToolsetSystemPromptHooks } from "@freeanima/capabilities-tools/toolset-prompt-hooks";
import { buildMemorySystemPromptSections } from "@freeanima/life-memory/system-prompt-sections";
import { loadSelfLayerPrompt } from "@freeanima/life-self";
import type { ToolSetRegistry } from "@freeanima/engine-tool";

export function registerMemorySystemPromptHooks(registry: HookRegistry): void {
  registry.on(systemPromptBuild, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const sections = await buildMemorySystemPromptSections(selfContent, ctx.cwd);
    if (!sections.length) return { status: "ok" };
    return { status: "ok", data: { sections } };
  });
}

export function registerSystemPromptHooks(opts: {
  hookRegistry: HookRegistry;
  getToolRegistry: () => ToolSetRegistry;
}): void {
  registerMemorySystemPromptHooks(opts.hookRegistry);
  registerToolsetSystemPromptHooks(opts.hookRegistry, opts.getToolRegistry);
}
