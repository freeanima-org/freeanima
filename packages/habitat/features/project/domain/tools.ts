import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

export { buildProjectToolDefs } from "./project-tools.ts";

/** @deprecated Prefer registerTaskTools which includes project tools. */
export function registerProjectTools(_toolSets: ToolSetRegistry): void {
  // Project tools are registered as part of the `task` ToolSet.
}

/** 供测试重置 */
export function resetProjectToolsForTests(): void {}
