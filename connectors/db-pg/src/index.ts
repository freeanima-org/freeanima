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
  buildPgTsQuery,
  rebuildAllFtsSegments,
  resetJiebaForTest,
  type FtsRebuildResult,
} from "./fts/index.ts";
