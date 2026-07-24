import type { ToolSetRegistry } from "@freeanima/host/core/tool";

import { registerProjectTools as registerProjectToolSet } from "./project-tools.ts";

export function registerProjectTools(toolSets: ToolSetRegistry): void {
  registerProjectToolSet(toolSets);
}

/** 供测试重置 */
export function resetProjectToolsForTests(): void {}
