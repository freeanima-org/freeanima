/** Entity feature domain — Habitat service uses host PG repos directly. */
export const ENTITY_FEATURE_ID = "entity" as const;

export { EntityAttachError, assertAttachAllowed, assertPromoteAllowed } from "./attach-policy.ts";
export { buildEntityMorphToolDefs } from "./entity-morph-tools.ts";
