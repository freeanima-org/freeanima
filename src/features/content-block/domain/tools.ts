import type { ToolSetRegistry } from "@freeanima/host/core/tool";

import { registerContentBlockToolSet } from "./content-block-tools.ts";

export function registerContentBlockTools(toolSets: ToolSetRegistry): void {
  registerContentBlockToolSet(toolSets);
}

/** 供测试重置 */
export function resetContentBlockToolsForTests(): void {}
