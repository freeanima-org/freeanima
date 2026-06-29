import type { ToolSetRegistry } from "@freeanima/core/tool";

import { registerDiaryTools as registerDiaryToolSet } from "./diary-tools.ts";

export function registerDiaryTools(toolSets: ToolSetRegistry): void {
  registerDiaryToolSet(toolSets);
}

/** 供测试重置 */
export function resetDiaryToolsForTests(): void {}
