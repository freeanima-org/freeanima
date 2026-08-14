import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { registerMemoryCoreTools } from "./memory.ts";
import { registerMemoryLimbicTools } from "./memory-limbic.ts";
import { registerMemorySemanticTools } from "./memory-semantic.ts";
import { registerMemoryServiceMcpTools } from "./memory-service-mcp-tools.ts";

export function registerMemoryTools(toolSets: ToolSetRegistry): void {
  registerMemoryCoreTools(toolSets);
  registerMemorySemanticTools(toolSets);
  registerMemoryLimbicTools(toolSets);
  registerMemoryServiceMcpTools(toolSets);
}
