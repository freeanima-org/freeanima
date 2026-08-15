import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import { PROMPT_XML_TAGS, systemPromptBuild } from "@freeanima/habitat/core/hooks/prompt";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { renderToolsetsBody } from "./toolset-prompt.ts";

export function registerToolsetSystemPromptHooks(
  registry: HookRegistry,
  getToolRegistry: () => ToolSetRegistry,
): void {
  registry.on(
    systemPromptBuild,
    () => {
      const content = renderToolsetsBody(getToolRegistry());
      if (!content.trim()) return { status: "ok" };
      return {
        status: "ok",
        data: {
          sections: [
            {
              id: "toolsets",
              content,
              order: 10,
              priority: 5,
              budgetChars: 4_500,
              xmlTag: PROMPT_XML_TAGS.toolsets,
            },
          ],
        },
      };
    },
    { llm_kind: "conversation" },
  );
}
