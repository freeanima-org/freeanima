import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

export { buildDiaryToolDefs } from "./diary-tools.ts";

/** @deprecated Prefer registerContentBlockTools which registers the `content` ToolSet. */
export function registerDiaryTools(_toolSets: ToolSetRegistry): void {
  // Diary tools are registered as part of the `content` ToolSet.
}

/** 供测试重置 */
export function resetDiaryToolsForTests(): void {}
