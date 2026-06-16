import type { ToolSetRegistry } from "@freeanima/core/tool";
import { registerDreamTools } from "./dream.ts";
import { registerMemoryCoreTools } from "./memory.ts";
import { registerMemorySemanticTools } from "./memory-semantic.ts";

export function registerMemoryTools(toolSets: ToolSetRegistry): void {
  registerMemoryCoreTools(toolSets);
  registerMemorySemanticTools(toolSets);
  registerDreamTools(toolSets);
}
