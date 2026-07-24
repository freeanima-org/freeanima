import type { HookRegistry } from "@freeanima/host/kernel/hooks";
import { systemPromptBuild } from "@freeanima/host/core/hooks/prompt";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { renderToolsetsSection } from "./toolset-prompt.ts";

export function registerToolsetSystemPromptHooks(
  registry: HookRegistry,
  getToolRegistry: () => ToolSetRegistry,
): void {
  registry.on(systemPromptBuild, () => {
    const content = renderToolsetsSection(getToolRegistry());
    if (!content.trim()) return { status: "ok" };
    return {
      status: "ok",
      data: {
        sections: [{ id: "toolsets", content, order: 10 }],
      },
    };
  });
}
