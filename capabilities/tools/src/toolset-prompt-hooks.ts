import type { HookRegistry } from "@freeanima/kernel/hooks";
import { systemPromptBuild } from "@freeanima/mechanism-hooks/prompt";
import type { ToolSetRegistry } from "@freeanima/mechanism-tool";
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
