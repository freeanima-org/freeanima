export * from "./types.ts";
export {
  createEntity,
  createEntityAtId,
  getEntity,
  updateEntity,
  deleteEntity,
  listEntities,
  countEntities,
  countEntitiesByBodyListId,
} from "./repos/entity-crud-repo.ts";
export {
  searchEntities,
  countEntitiesSearch,
  EntitySearchScopeError,
} from "./search/entity-search-repo.ts";
export {
  resolvePublicAccessibleWorldIds,
  resolveWorldsAccessibleBySubject,
} from "./search/accessible-worlds.ts";
export {
  ensureWorldSubjects,
  createSubjectEntityRecord,
  createDefaultPrivateWorldForSubject,
  buildWorldConfigBody,
  EntitySubjectBootstrapError,
  type EnsuredWorldSubjects,
} from "./subject-world.ts";
export {
  assertValidWorldId,
  assertEntityInWorld,
  assertSameWorldReferent,
  assertPrivateWorldOwnedBySubject,
  EntityWorldError,
} from "./world-assert.ts";
export {
  resolveDefaultPrivateWorldForSubject,
  assertSubjectCanAccessWorld,
  resolveWorldFromEntityId,
  resolveDefaultWorldForToolCaller,
  resolveToolWorld,
  ToolWorldAccessError,
  type ResolveToolWorldOpts,
} from "./tool-world-access.ts";
