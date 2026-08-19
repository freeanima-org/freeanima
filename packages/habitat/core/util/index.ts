/** 浏览器可安全导入的 util 桶。Node-only（createTempDir 等）请用 `@freeanima/habitat/core/util/temp-dir`。 */
export { safeParseOrNull, formatZodError } from "./json.ts";
export { DATE_JSON_KEYS, isPlainIsoDateString, reviveDates } from "./date-json.ts";
export {
  CST_OFFSET_MS,
  formatCstDisplay,
  formatCstDisplayFromEpoch,
  formatCstDisplayFromMs,
  formatCstIso,
  formatCstIsoFromEpoch,
  formatCstWeekdayZh,
  isCstMonday,
  hostCalendarDay,
  hostDayBoundsIso,
  type FormatCstDisplayOpts,
} from "./time.ts";
export { isEnabledByDefault } from "./config.ts";
export {
  rrfMerge,
  semanticMemoryDocKey,
  messageDocKey,
  limbicDocKey,
  autobiographicalDocKey,
  entityDocKey,
  type RrfScoredHit,
} from "./fts/rrf.ts";
export {
  FtsQueryError,
  isFtsQueryError,
  formatFtsToolError,
  type FtsQueryErrorCode,
} from "./fts/query-error.ts";
export {
  FTS_QUERY_OPERATORS,
  hasFtsQueryOperators,
  parseFtsOperatorQuery,
  flushOperandGroup,
  buildOperatorTsQuery,
  tokenizeFtsQuery,
  type FtsOperatorSegment,
  type FtsQueryOperator,
  type FtsQueryOperatorSymbol,
} from "./fts/query-operators.ts";
export { validateFtsQueryInput, assertValidTsQueryString } from "./fts/query-validate.ts";
export {
  buildTextSearchSnippet,
  extractSearchTerms,
  formatStoredMessageSearchHit,
  type StoredMessageSearchFields,
  type StoredMessageSearchHit,
  type TextSearchSnippetOpts,
} from "./search/snippet.ts";
export { omitUndefined } from "./omit-undefined.ts";
