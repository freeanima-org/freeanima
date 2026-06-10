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
  type SqlClient,
} from "./client.ts";
export { pingDatabase, type DatabasePingStatus } from "./health.ts";
export { createPgRepositories } from "./factory.ts";
export { messagesForCompress } from "./queries/messages-for-compress.ts";
export {
  buildFtsTsQuery,
  rebuildAllFtsSegments,
  resetJiebaForTest,
  registerEmbedTextFn,
  registerEmbedTextsFn,
  resetEmbedTextFnForTest,
  resetEmbedTextsFnForTest,
  flushEmbeddingQueueForTest,
  resetEmbeddingQueueForTest,
  getFtsCoverageStats,
  startFtsRebuildJob,
  getFtsRebuildJobStatus,
  type FtsRebuildResult,
  type FtsCoverageStats,
  type FtsTableCoverageRow,
  type FtsTableCapabilities,
  type FtsRebuildJobStatus,
} from "./fts/index.ts";
