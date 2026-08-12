/** Compact system-prompt rule for chat entity refs `[[anima:id]]`. */

export const ANIMA_URI_PROTOCOL_RULE =
  "## Anima URI\n" +
  "`[[anima:{id}]]` or `[[anima:{id}?component=…]]` = `entities.id` (any kind—not memory-only). " +
  'Resolve: `toolset_load(["entity"])` → `entity_get({id})` → domain tool by `primary_component` ' +
  "(or by `?component=`). Append `[[anima:id]]` at reply end only when using semantic memory " +
  "(see memory-citation).";
