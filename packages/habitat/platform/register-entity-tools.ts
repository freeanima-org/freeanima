import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { buildEntitySearchToolDefs } from "@freeanima/habitat/capabilities/tools/entity-search.ts";
import { buildTagToolDefs } from "@freeanima/features/tag/domain/tag-tools.ts";

/** Entity lookup/search + tags (merged ToolSet). */
export function registerEntityAndTagTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "entity",
    "Entity lookup/search and per-world tags (resolve [[anima:id]] via entity_get)",
    [...buildEntitySearchToolDefs(), ...buildTagToolDefs()],
  );
}
