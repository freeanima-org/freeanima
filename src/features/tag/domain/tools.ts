import type { ToolSetRegistry } from "@freeanima/core/tool";

import { registerTagTools as registerTagToolSet } from "./tag-tools.ts";

export function registerTagTools(toolSets: ToolSetRegistry): void {
  registerTagToolSet(toolSets);
}

/** 供测试重置 */
export function resetTagToolsForTests(): void {}
