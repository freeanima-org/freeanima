import type { FullRuntimeDeps } from "./service/runtime-deps.ts";
import { registerLlmStackConfigurator } from "@freeanima/host/core/llm";
import { registerSystemPromptHookRunner } from "@freeanima/host/core/hooks/prompt";
import { rebuildConversationCache } from "@freeanima/host/engine/conversation";
import { registerConversationToolMaskFilter } from "@freeanima/host/core/tool";
import { registerCompressionSummaryPostCut } from "@freeanima/host/core/compress";
import { bindOpenAiCompatibleLlm } from "@freeanima/host/capabilities/llm-openai";
import { foldSystemPromptSections, systemPromptBuild } from "@freeanima/host/core/hooks/prompt";
import { filterToolNamesByMask, resolveConversationMaskFromMeta } from "./service/mask-bind.ts";
import { getAppRuntime } from "./context.ts";

/** Composition-root binding for engine injection ports (call once before initLlmRuntime) */
export function bindEnginePorts(): void {
  registerLlmStackConfigurator(bindOpenAiCompatibleLlm);

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

  registerCompressionSummaryPostCut(async (conversation) => {
    const { engine } = getAppRuntime();
    await rebuildConversationCache(engine.catalog.toolSets, conversation);
  });
}

/** Late bind after AppRuntime exists; hooks above call getAppRuntime at runtime */
export function bindEnginePortRuntime(_deps: FullRuntimeDeps): void {
  /* composition marker — runtime resolved via getAppRuntime() in callbacks */
}
