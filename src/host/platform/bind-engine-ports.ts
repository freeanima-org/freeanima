import type { FullRuntimeDeps } from "./service/runtime-deps.ts";
import { registerLlmStackConfigurator } from "@freeanima/host/core/llm";
import { registerSystemPromptHookRunner } from "@freeanima/host/core/hooks/prompt";
import { rebuildConversationCache } from "@freeanima/host/engine/conversation";
import { registerConversationToolPolicyFilter } from "@freeanima/host/core/tool";
import { registerCompressionSummaryPostCut } from "@freeanima/host/core/compress";
import { bindLlmStack } from "@freeanima/host/capabilities/llm-openai";
import { foldSystemPromptSections, systemPromptBuild } from "@freeanima/host/core/hooks/prompt";
import {
  DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS,
  peekActiveRuntimeConfig,
} from "@freeanima/host/core/config";
import { getAppRuntime } from "./context.ts";

/** Composition-root binding for engine injection ports (call once before initLlmRuntime) */
export function bindEnginePorts(): void {
  registerLlmStackConfigurator(bindLlmStack);

  registerSystemPromptHookRunner(async (ctx) => {
    const { kernel } = getAppRuntime();
    const run = await kernel.hookRegistry.run(systemPromptBuild, ctx, {
      llm_kind: "conversation",
    });
    const budget =
      peekActiveRuntimeConfig()?.data.prompt?.system_prompt_budget_chars ??
      DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS;
    return foldSystemPromptSections(run.chain, { globalBudgetChars: budget });
  });

  // 可见对话不强制收窄工具；看不见场景（sleep/cron）经 CapabilityPolicy 传入 toolPolicy
  registerConversationToolPolicyFilter((toolNames, _meta) => toolNames);

  registerCompressionSummaryPostCut(async (conversation) => {
    const { engine } = getAppRuntime();
    await rebuildConversationCache(engine.catalog.toolSets, conversation);
  });
}

/** Late bind after AppRuntime exists; hooks above call getAppRuntime at runtime */
export function bindEnginePortRuntime(_deps: FullRuntimeDeps): void {
  /* composition marker — runtime resolved via getAppRuntime() in callbacks */
}
