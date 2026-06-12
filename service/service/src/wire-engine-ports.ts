import { registerLlmStackConfigurator } from "@freeanima/engine-llm";
import { registerSystemPromptHookRunner } from "@freeanima/engine-prompt";
import { rebuildSessionSystemPrompt } from "@freeanima/engine-conversation";
import { registerSessionToolMaskFilter } from "@freeanima/engine-tool";
import { registerCompressionSummaryPostCut } from "@freeanima/engine-compress";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-provider-openai-compatible";
import { foldSystemPromptSections, systemPromptBuild } from "@freeanima/engine-hooks/prompt";
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
