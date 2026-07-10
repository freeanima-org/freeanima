import type { ToolSetRegistry } from "@freeanima/core/tool";

import { registerDreamTools as registerDreamToolSet } from "./dream-tools.ts";

export function registerDreamTools(toolSets: ToolSetRegistry): void {
  registerDreamToolSet(toolSets);
}
