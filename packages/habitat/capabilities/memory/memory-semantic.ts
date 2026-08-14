import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns } from "@freeanima/habitat/core/tool";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { semanticMemoryToolDefs } from "./semantic-memory-tools.ts";
import { autobiographicalMemoryToolDefs } from "./autobiographical-tools.ts";

/** 只读：自传 search；create/deprecate 已下线（#16102 存量只读） */
const autobiographicalReadToolDefs = autobiographicalMemoryToolDefs.filter(
  (t) => t.name === "memory_autobiographical_search",
);

export function registerMemorySemanticTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory_semantic",
    "Semantic memory tools（limbic/narrative 写入已下线）",
    attachToolReturns(
      [...semanticMemoryToolDefs, ...autobiographicalReadToolDefs],
      MEMORY_TOOL_RETURNS,
    ),
    { visibility: "searchable" },
  );
}
