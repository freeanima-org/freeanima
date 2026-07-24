import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns } from "@freeanima/host/core/tool";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { limbicSearchToolDefs } from "./limbic-search-tools.ts";

export function registerMemoryLimbicTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory_limbic",
    "Limbic emotional memory search and retrieval",
    attachToolReturns([...limbicSearchToolDefs], MEMORY_TOOL_RETURNS),
  );
}
