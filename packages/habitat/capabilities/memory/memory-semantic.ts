import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns } from "@freeanima/habitat/core/tool";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { semanticMemoryToolDefs } from "./semantic-memory-tools.ts";

export function registerMemorySemanticTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory_semantic",
    "Semantic memory tools（limbic/narrative 写入已下线；情绪/自传检索用 content_block_search）",
    attachToolReturns([...semanticMemoryToolDefs], MEMORY_TOOL_RETURNS),
    { visibility: "searchable" },
  );
}
