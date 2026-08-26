import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import { PROMPT_XML_TAGS, systemPromptBuild } from "@freeanima/habitat/core/hooks/prompt";
import {
  applyConversationToolPolicyFilter,
  isCodingConversationMeta,
  type ToolSetRegistry,
} from "@freeanima/habitat/core/tool";
import { CODING_HANDS_INTRO, renderToolsetsBody } from "./toolset-prompt.ts";

export function registerToolsetSystemPromptHooks(
  registry: HookRegistry,
  getToolRegistry: () => ToolSetRegistry,
): void {
  registry.on(
    systemPromptBuild,
    (ctx) => {
      const toolRegistry = getToolRegistry();
      const allNames = toolRegistry.listTools().map((t) => t.name);
      const meta = ctx.meta;
      const allowed = meta ? applyConversationToolPolicyFilter(allNames, meta) : allNames;
      const content = renderToolsetsBody(toolRegistry, {
        allowedToolNames: allowed,
        ...(meta && isCodingConversationMeta(meta)
          ? { extraIntro: CODING_HANDS_INTRO, omitGenericIntro: true }
          : {}),
      });
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
