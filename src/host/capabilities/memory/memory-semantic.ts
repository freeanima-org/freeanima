import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns } from "@freeanima/host/core/tool";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { semanticMemoryToolDefs } from "./semantic-memory-tools.ts";
import { autobiographicalMemoryToolDefs } from "./autobiographical-tools.ts";
import { limbicMemoryToolDefs } from "./limbic-tools.ts";

export function registerMemorySemanticTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory_semantic",
    "Advanced semantic, limbic, and autobiographical memory tools",
    attachToolReturns(
      [...semanticMemoryToolDefs, ...autobiographicalMemoryToolDefs, ...limbicMemoryToolDefs],
      MEMORY_TOOL_RETURNS,
    ),
    { visibility: "searchable" },
  );
}
