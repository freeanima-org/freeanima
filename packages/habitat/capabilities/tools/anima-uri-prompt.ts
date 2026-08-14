/** Compact system-prompt rule for chat entity refs `[[anima:id]]`. */

export const ANIMA_URI_PROTOCOL_BODY =
  "`[[anima:{id}]]` or `[[anima:{id}?component=…]]` = `entities.id` (any kind—not memory-only). " +
  'Resolve: `toolset_load(["entity"])` → `entity_get({id})` → domain tool by `primary_component` ' +
  "(or by `?component=`). Append `[[anima:id]]` at reply end only when using semantic memory " +
  "(see memory-citation).";

/** @deprecated Prefer body + xmlTag in systemPromptBuild; kept for string containment checks. */
export const ANIMA_URI_PROTOCOL_RULE = ANIMA_URI_PROTOCOL_BODY;
