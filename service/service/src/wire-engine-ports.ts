import { registerLlmStackConfigurator } from "@freeanima/engine-llm";
import { registerSystemPromptBuilder } from "@freeanima/engine-prompt";
import { rebuildSessionSystemPrompt } from "@freeanima/engine-conversation";
import { registerSessionToolMaskFilter } from "@freeanima/engine-tool";
import { registerCompressionSummaryPostCut } from "@freeanima/engine-compress";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-provider-openai-compatible";
import { loadSelfLayerPrompt } from "@freeanima/life-self";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts as decomposeBase,
} from "@freeanima/life-memory/system-prompt";
import { filterToolNamesByMask, resolveSessionMaskFromMeta } from "./runtime/mask-wire.ts";

/** Composition-root wiring for engine injection ports (call once before initLlmRuntime) */
export function wireEnginePorts(): void {
  registerLlmStackConfigurator(wireOpenAiCompatibleLlm);

  registerSystemPromptBuilder(async (_functionNames, cwd) => {
    const selfContent = await loadSelfLayerPrompt();
    const parts = await decomposeBase(selfContent, cwd);
    return composeSystemPrompt(parts);
  });

  registerSessionToolMaskFilter((toolNames, meta) => {
    const resolved = resolveSessionMaskFromMeta(meta);
    if (!resolved) return toolNames;
    return filterToolNamesByMask(toolNames, resolved);
  });

  registerCompressionSummaryPostCut(rebuildSessionSystemPrompt);
}
