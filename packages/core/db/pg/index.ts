export {
  closeDb,
  getActivePoolOptions,
  getDatabaseConfig,
  getDb,
  getSqlClient,
  initDatabase,
  isPostgresPrimary,
  resetDatabaseForTest,
  setDbForTest,
  startDatabasePoolHealer,
  type DatabaseConfig,
  type DatabaseUrlResolver,
  type Db,
  type DbSession,
  type DbTransaction,
  type SqlClient,
} from "./client.ts";
export {
  DEFAULT_PG_POOL_HEAL_INTERVAL_MS,
  DEFAULT_PG_POOL_MAX_LIFETIME_SEC,
  PG_HEAL_APP_NAME,
  PG_POOL_APP_NAME,
  resolvePoolOptions,
  type PgPoolOptions,
} from "./pool-options.ts";
export {
  drainPoolWithRollback,
  runPoolHealTick,
  startPgPoolHealer,
  stopPgPoolHealer,
  type PoolHealDeps,
  type PoolHealTickResult,
} from "./pool-heal.ts";
export { withAdvisoryXactLock } from "./advisory-lock.ts";
export { pingDatabase, type DatabasePingStatus } from "./health.ts";
export { EntitySearchScopeError, resolvePublicAccessibleWorldIds } from "./entity/index.ts";
export { messagesForCompress } from "./queries/messages-for-compress.ts";
export {
  buildFtsTsQuery,
  rebuildAllFtsSegments,
  resetJiebaForTest,
  isJiebaLoaded,
  registerEmbedTextFn,
  registerEmbedTextsFn,
  registerAfterEmbeddingStored,
  resetEmbedTextFnForTest,
  resetEmbedTextsFnForTest,
  resetAfterEmbeddingStoredForTest,
  awaitPendingEmbeddingsForTest,
  resetPendingEmbeddingsForTest,
  getFtsCoverageStats,
  startFtsRebuildJob,
  getFtsRebuildJobStatus,
  type FtsRebuildResult,
  type FtsCoverageStats,
  type FtsTableCoverageRow,
  type FtsTableCapabilities,
  type FtsRebuildJobStatus,
} from "./fts/index.ts";
export {
  bindSearchRuntime,
  getSearchBackend,
  registerSearchBackend,
  resetSearchBackendForTest,
  tryGetSearchBackend,
} from "./search/index.ts";
export {
  getHabitatRuntimeConfigDocument,
  mergeSection,
  patchHabitatRuntimeConfigSection,
  replaceSection,
  replaceHabitatRuntimeConfigSection,
  replaceHabitatRuntimeConfigDocument,
  upsertHabitatRuntimeConfigDocument,
} from "./config/index.ts";
