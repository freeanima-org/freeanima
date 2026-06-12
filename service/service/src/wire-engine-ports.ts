import { registerLlmStackConfigurator } from "@freeanima/mechanism-llm";
import { registerSystemPromptHookRunner } from "@freeanima/mechanism-hooks/prompt";
import { rebuildSessionSystemPrompt } from "@freeanima/orchestration-conversation";
import { registerSessionToolMaskFilter } from "@freeanima/mechanism-tool";
import { registerCompressionSummaryPostCut } from "@freeanima/mechanism-compress";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-llm-openai";
import { foldSystemPromptSections, systemPromptBuild } from "@freeanima/mechanism-hooks/prompt";
import { filterToolNamesByMask, resolveSessionMaskFromMeta } from "./runtime/mask-wire.ts";
import { getServiceContext } from "./context.ts";

/** Composition-root wiring for engine injection ports (call once before initLlmRuntime) */
export function wireEnginePorts(): void {
  registerLlmStackConfigurator(wireOpenAiCompatibleLlm);

  registerSystemPromptHookRunner(async (ctx) => {
    const run = await getServiceContext().kernel.hookRegistry.run(systemPromptBuild, ctx);
    return foldSystemPromptSections(run.chain);
  });

  registerSessionToolMaskFilter((toolNames, meta) => {
    const resolved = resolveSessionMaskFromMeta(meta);
    if (!resolved) return toolNames;
    return filterToolNamesByMask(toolNames, resolved);
  });

  registerCompressionSummaryPostCut(rebuildSessionSystemPrompt);
}
