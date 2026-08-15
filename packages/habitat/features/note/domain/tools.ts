import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

export { buildNoteToolDefs } from "./note-tools.ts";

/** @deprecated Prefer registerContentBlockTools which registers the `content` ToolSet. */
export function registerNoteTools(_toolSets: ToolSetRegistry): void {
  // Note tools are registered as part of the `content` ToolSet.
}

/** 供测试重置 */
export function resetNoteToolsForTests(): void {}
