import type { ToolSetRegistry } from "@freeanima/host/core/tool";

import { registerCalendarToolSet } from "./calendar-tools.ts";

export function registerCalendarTools(toolSets: ToolSetRegistry): void {
  registerCalendarToolSet(toolSets);
}
