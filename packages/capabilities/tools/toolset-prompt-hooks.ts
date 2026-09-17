import type { Context } from "cordis";
import { onSystemPromptBuild } from "@freeanima/core/hooks/cordis";
import { PROMPT_XML_TAGS } from "@freeanima/core/hooks/prompt";
import {
  applyConversationToolPolicyFilter,
  isCodingConversationMeta,
  type ToolSetRegistry,
} from "@freeanima/core/tool";
import { CODING_HANDS_INTRO, renderToolsetsBody } from "./toolset-prompt.ts";

export function registerToolsetSystemPromptHooks(
  ctx: Context,
  getToolRegistry: () => ToolSetRegistry,
): void {
  onSystemPromptBuild(ctx, (event) => {
    const toolRegistry = getToolRegistry();
    const allNames = toolRegistry.listTools().map((t) => t.name);
    const meta = event.meta;
    const allowed = meta ? applyConversationToolPolicyFilter(allNames, meta) : allNames;
    const content = renderToolsetsBody(toolRegistry, {
      allowedToolNames: allowed,
      ...(meta && isCodingConversationMeta(meta)
        ? { extraIntro: CODING_HANDS_INTRO, omitGenericIntro: true }
        : {}),
    });
    if (!content.trim()) return undefined;
    return {
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
    };
  });
}
