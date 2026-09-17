import type { FullRuntimeDeps } from "./service/runtime-deps.ts";
import { rebuildConversationCache } from "@freeanima/engine/conversation";
import { registerCompressionSummaryPostCut } from "@freeanima/core/compress";
import { getAppRuntime } from "./context.ts";

/**
 * Composition-root binding for engine injection ports (call once before initLlmRuntime).
 *
 * LLM stack + tool policy are mounted as Cordis services in `bootEnginePhase`;
 * only the compression post-cut port remains a plain registration here.
 */
export function bindEnginePorts(): void {
  registerCompressionSummaryPostCut(async (conversation) => {
    const { engine } = getAppRuntime();
    await rebuildConversationCache(engine.catalog.toolSets, conversation);
  });
}

/** Late bind after AppRuntime exists; hooks above call getAppRuntime at runtime */
export function bindEnginePortRuntime(_deps: FullRuntimeDeps): void {
  /* composition marker — runtime resolved via getAppRuntime() in callbacks */
}
