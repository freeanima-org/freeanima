export type {
  SearchBackend,
  SearchChannel,
  SearchDoc,
  SearchFilters,
  SearchHit,
  SearchQuery,
  SearchReranker,
  SearchResource,
} from "./types.ts";
export { UnsupportedSearchChannelError } from "./types.ts";
export {
  getSearchBackend,
  registerSearchBackend,
  resetSearchBackendForTest,
  tryGetSearchBackend,
} from "./runtime.ts";
export { fuseSearchHits } from "./fusion.ts";
export { applyRerank, identityReranker } from "./rerank.ts";
export { searchDocKey, parseSearchDocKey } from "./doc-key.ts";
export { entityToSearchDoc, messageToSearchDoc } from "./docs-from-business.ts";
export { bindSearchRuntime } from "./bind.ts";
export { createPgBusinessScanBackend } from "./pg-business-scan.ts";
export {
  createPgSearchIndexBackend,
  setSearchDocumentEmbedding,
  clearSearchDocumentEmbedding,
  setSearchDocumentClusterId,
  patchEntitySearchDocumentClusterIds,
} from "./pg-search-index/backend.ts";
export {
  listActiveSemanticMemoryEmbeddings,
  listActiveSemanticMemoryClusterIds,
  findNearestClusteredNeighbor,
  getEntitySearchDocumentClusterId,
  type SemanticEmbeddingClusterRow,
  type SemanticClusterIdRow,
} from "./clustering-repo.ts";
export {
  entitySearchDocumentsJoin,
  messageSearchDocumentsJoin,
  searchDocumentsFtsMatch,
  searchDocumentsFtsRankExpr,
} from "./pg-search-index/channel-fts.ts";
