import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

import { registerNoteTools as registerNoteToolSet } from "./note-tools.ts";

export function registerNoteTools(toolSets: ToolSetRegistry): void {
  registerNoteToolSet(toolSets);
}

/** 供测试重置 */
export function resetNoteToolsForTests(): void {}
