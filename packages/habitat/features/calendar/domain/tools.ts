import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

export { buildCalendarToolDefs } from "./calendar-tools.ts";

/** @deprecated Prefer registerTaskTools which registers the `agenda` ToolSet. */
export function registerCalendarTools(_toolSets: ToolSetRegistry): void {
  // Calendar tools are registered as part of the `agenda` ToolSet.
}

/** 供测试重置 */
export function resetCalendarToolsForTests(): void {}
