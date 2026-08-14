import type { FullRuntimeDeps } from "./service/runtime-deps.ts";
import { registerLlmStackConfigurator } from "@freeanima/habitat/core/llm";
import { registerSystemPromptHookRunner } from "@freeanima/habitat/core/hooks/prompt";
import { rebuildConversationCache } from "@freeanima/habitat/engine/conversation";
import { registerConversationToolPolicyFilter } from "@freeanima/habitat/core/tool";
import { registerCompressionSummaryPostCut } from "@freeanima/habitat/core/compress";
import { bindLlmStack } from "@freeanima/habitat/capabilities/llm-openai";
import {
  foldSystemPromptSectionsDetailed,
  systemPromptBuild,
} from "@freeanima/habitat/core/hooks/prompt";
import {
  DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS,
  peekActiveRuntimeConfig,
} from "@freeanima/habitat/core/config";
import { getAppRuntime } from "./context.ts";
import { notifyPromptFoldBudgetSoftFailure } from "./service/prompt-fold-soft-failure-notify.ts";

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
    const folded = foldSystemPromptSectionsDetailed(run.chain, { globalBudgetChars: budget });
    void notifyPromptFoldBudgetSoftFailure(folded);
    return folded.text;
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
