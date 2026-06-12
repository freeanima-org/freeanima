export { buildFtsTsQuery, buildCharModeTsQuery, buildJiebaModeTsQuery } from "./query.ts";
export { segmentForFts, resetJiebaForTest } from "./segment.ts";
export { resolveFtsSegmentedForWrite } from "./write.ts";
export { rebuildAllFtsSegments, type FtsRebuildResult, type FtsRebuildOptions } from "./rebuild.ts";
export {
  startFtsRebuildJob,
  getFtsRebuildJobStatus,
  resetFtsRebuildJobForTest,
  type FtsRebuildJobStatus,
} from "./rebuild-job.ts";
export type { FtsRebuildPhase, FtsRebuildProgress } from "./rebuild-types.ts";
export {
  getFtsCoverageStats,
  type FtsCoverageStats,
  type FtsTableCoverageRow,
  type FtsTableCapabilities,
} from "./coverage.ts";
export {
  rrfMerge,
  semanticMemoryDocKey,
  messageDocKey,
  limbicDocKey,
  autobiographicalDocKey,
} from "@freeanima/storage-util";
export { hybridSearchSemanticMemory, hybridSearchMessages } from "./hybrid-search.ts";
export {
  registerEmbedTextFn,
  registerEmbedTextsFn,
  resetEmbedTextFnForTest,
  resetEmbedTextsFnForTest,
} from "../embedding/runtime.ts";
export {
  awaitPendingEmbeddingsForTest,
  resetPendingEmbeddingsForTest,
} from "../embedding/schedule.ts";
