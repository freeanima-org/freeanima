import type { ToolSetRegistry } from "@freeanima/core/tool";

import { registerTaskItemTools } from "./task-item-tools.ts";
import { registerTaskListTools } from "./tasklist-tools.ts";

export function registerTaskTools(toolSets: ToolSetRegistry): void {
  registerTaskItemTools(toolSets);
  registerTaskListTools(toolSets);
}

/** 供测试重置 */
export function resetTaskToolsForTests(): void {}
