export * from "./types.ts";
export {
  createEntity,
  createEntityAtId,
  getEntity,
  updateEntity,
  deleteEntity,
  deleteTaskItemsByListId,
  clearTaskItemMilestoneId,
  listEntities,
  countEntities,
  countEntitiesByBodyListId,
  countPendingTaskItemsByListId,
  countPendingTaskItemsGroupedByListId,
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
  getSubjectWorldAccessLevel,
  resolveWorldFromEntityId,
  resolveDefaultWorldForToolCaller,
  resolveToolWorld,
  listWorldIdsAccessibleBySubject,
  ToolWorldAccessError,
  type ResolveToolWorldOpts,
} from "./tool-world-access.ts";
export {
  subjectWorldAccessLevel,
  accessLevelMeets,
  type SubjectWorldAccessLevel,
} from "./subject-world-access.ts";
