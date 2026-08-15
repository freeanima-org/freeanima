import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

import { buildDiaryToolDefs } from "@freeanima/features/diary/domain/diary-tools.ts";
import { buildNoteToolDefs } from "@freeanima/features/note/domain/note-tools.ts";
import { buildContentBlockToolDefs } from "./content-block-tools.ts";

export function registerContentBlockTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet("content", "Diary, notes, and content blocks", [
    ...buildDiaryToolDefs(),
    ...buildNoteToolDefs(),
    ...buildContentBlockToolDefs(),
  ]);
}

/** 供测试重置 */
export function resetContentBlockToolsForTests(): void {}
