export {
  closeDb,
  getDatabaseConfig,
  getDb,
  initDatabase,
  isPostgresPrimary,
  resetDatabaseForTest,
  setDbForTest,
  type DatabaseConfig,
  type DatabaseUrlResolver,
  type Db,
  type DbSession,
  type DbTransaction,
  type SqlClient,
} from "./client.ts";
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
  resetEmbedTextFnForTest,
  resetEmbedTextsFnForTest,
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
  getHabitatRuntimeConfigDocument,
  mergeSection,
  patchHabitatRuntimeConfigSection,
  replaceSection,
  replaceHabitatRuntimeConfigSection,
  replaceHabitatRuntimeConfigDocument,
  upsertHabitatRuntimeConfigDocument,
} from "./config/index.ts";
