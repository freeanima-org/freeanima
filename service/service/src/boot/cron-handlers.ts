import { registerCronBuiltinHandler } from "@freeanima/connectors-cron";
import { runLightSleep } from "@freeanima/capabilities-memory/light-sleep/run";
import { runDeepSleep } from "@freeanima/capabilities-memory/deep-sleep/run";
import { syncSemanticMemoryReferenceCounts } from "@freeanima/capabilities-memory";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
} from "@freeanima/capabilities-identity";
import type { Engine } from "@freeanima/runtime";

/** 注册内置 cron handler（light/deep sleep、记忆引用同步） */
export function registerBootCronHandlers(engine: Engine): void {
  registerCronBuiltinHandler("builtin-light-sleep", async () => {
    const selfContent = await loadSelfLayerPrompt();
    const result = await runLightSleep({
      sessionStore: engine.repos.session,
      semanticStore: engine.repos.semanticMemory,
      autoStore: engine.repos.autobiographicalMemory,
      selfStore: engine.repos.selfLayer,
      selfContent,
    });
    invalidateSelfLayerPromptCache();
    await loadSelfLayerPrompt();
    return JSON.stringify(result);
  });

  registerCronBuiltinHandler("builtin-deep-sleep", async () => {
    const selfContent = await loadSelfLayerPrompt();
    const result = await runDeepSleep({ selfContent });
    return JSON.stringify(result);
  });

  registerCronBuiltinHandler("builtin-memory-reference-sync", async () => {
    const result = await syncSemanticMemoryReferenceCounts(engine.repos.memoryReference);
    return JSON.stringify(result);
  });
}
