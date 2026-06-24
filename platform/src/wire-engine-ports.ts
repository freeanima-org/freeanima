import type { FullRuntimeDeps } from "./runtime/runtime-deps.ts";
import { registerLlmStackConfigurator } from "@freeanima/core/llm";
import { registerSystemPromptHookRunner } from "@freeanima/core/hooks/prompt";
import { rebuildConversationCache } from "@freeanima/runtime/conversation";
import { registerConversationToolMaskFilter } from "@freeanima/core/tool";
import { registerCompressionSummaryPostCut } from "@freeanima/core/compress";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-llm-openai";
import { foldSystemPromptSections, systemPromptBuild } from "@freeanima/core/hooks/prompt";
import { filterToolNamesByMask, resolveConversationMaskFromMeta } from "./runtime/mask-wire.ts";
import { getAppRuntime } from "./context.ts";

/** Composition-root wiring for engine injection ports (call once before initLlmRuntime) */
export function wireEnginePorts(): void {
  registerLlmStackConfigurator(wireOpenAiCompatibleLlm);

  registerSystemPromptHookRunner(async (ctx) => {
    const { kernel } = getAppRuntime();
    const run = await kernel.hookRegistry.run(systemPromptBuild, ctx);
    return foldSystemPromptSections(run.chain);
  });

  registerConversationToolMaskFilter((toolNames, meta) => {
    const deps = getAppRuntime().fullDeps();
    const resolved = resolveConversationMaskFromMeta(deps, meta);
    if (!resolved) return toolNames;
    return filterToolNamesByMask(toolNames, resolved);
  });

  registerCompressionSummaryPostCut(async (repos, conversation) => {
    const { engine } = getAppRuntime();
    await rebuildConversationCache(repos, engine.catalog.toolSets, conversation);
  });
}

/** Late wire after AppRuntime exists; hooks above call getAppRuntime at runtime */
export function bindEnginePortRuntime(_deps: FullRuntimeDeps): void {
  /* composition marker — runtime resolved via getAppRuntime() in callbacks */
}
