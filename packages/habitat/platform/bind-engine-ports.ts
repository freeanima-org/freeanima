import type { FullRuntimeDeps } from "./service/runtime-deps.ts";
import { registerLlmStackConfigurator } from "@freeanima/habitat/core/llm";
import { rebuildConversationCache } from "@freeanima/habitat/engine/conversation";
import {
  filterHabitatLocalHandsForCoding,
  registerConversationToolPolicyFilter,
} from "@freeanima/habitat/core/tool";
import { registerCompressionSummaryPostCut } from "@freeanima/habitat/core/compress";
import { bindLlmStack } from "@freeanima/habitat/capabilities/llm-openai";
import { getAppRuntime } from "./context.ts";

/** Composition-root binding for engine injection ports (call once before initLlmRuntime) */
export function bindEnginePorts(): void {
  registerLlmStackConfigurator(bindLlmStack);

  // 可见对话不强制收窄工具；编码会话去掉栖息地本机 file/shell（走前哨 remote_coding_*）
  registerConversationToolPolicyFilter((toolNames, meta) =>
    filterHabitatLocalHandsForCoding(toolNames, meta),
  );

  registerCompressionSummaryPostCut(async (conversation) => {
    const { engine } = getAppRuntime();
    await rebuildConversationCache(engine.catalog.toolSets, conversation);
  });
}

/** Late bind after AppRuntime exists; hooks above call getAppRuntime at runtime */
export function bindEnginePortRuntime(_deps: FullRuntimeDeps): void {
  /* composition marker — runtime resolved via getAppRuntime() in callbacks */
}
