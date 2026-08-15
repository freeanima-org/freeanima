import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

export { buildTagToolDefs } from "./tag-tools.ts";

/** @deprecated Prefer platform `registerEntityAndTagTools` which registers the `entity` ToolSet. */
export function registerTagTools(_toolSets: ToolSetRegistry): void {
  // Tag tools are registered as part of the `entity` ToolSet.
}

/** 供测试重置 */
export function resetTagToolsForTests(): void {}
