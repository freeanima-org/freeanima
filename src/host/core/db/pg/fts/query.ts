import {
  assertValidTsQueryString,
  hasFtsQueryOperators,
  parseFtsOperatorQuery,
  validateFtsQueryInput,
} from "@freeanima/host/core/util";
import { getActiveRuntimeConfig } from "@freeanima/host/core/config";
import { isCjkJiebaEnabled } from "@freeanima/host/core/config/cjk-config";

import { extractContentWords } from "./content-words.ts";
import {
  buildCharModeTsQuery,
  buildJiebaGroupTsQuery,
  buildJiebaModeTsQuery,
} from "./query-char.ts";
import { isJiebaLoaded, segmentForFts } from "./segment.ts";

/** Prefer jieba tokens when loaded; otherwise char-mode (avoids whole-sentence lexeme). */
export function tsqueryAfterCjkSegment(
  raw: string,
  segmented: string,
  jiebaLoaded: boolean,
): string {
  return jiebaLoaded ? buildJiebaModeTsQuery(segmented) : buildCharModeTsQuery(raw);
}

/** Build tsquery from current cjk config (NL queries drop function words first). */
export async function buildFtsTsQuery(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  validateFtsQueryInput(trimmed);

  let tsquery: string;
  if (hasFtsQueryOperators(trimmed)) {
    if (isCjkJiebaEnabled(getActiveRuntimeConfig().data)) {
      tsquery = await buildJiebaOperatorTsQuery(trimmed);
    } else {
      tsquery = buildCharModeTsQuery(trimmed);
    }
  } else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    // Quoted phrase: exact adjacency; do not strip content words.
    tsquery = buildCharModeTsQuery(trimmed);
  } else if (isCjkJiebaEnabled(getActiveRuntimeConfig().data)) {
    const content = await extractContentWords(trimmed);
    const forQuery = content.query;
    const segmented = await segmentForFts(forQuery);
    tsquery = tsqueryAfterCjkSegment(forQuery, segmented, isJiebaLoaded());
  } else {
    const content = await extractContentWords(trimmed);
    tsquery = buildCharModeTsQuery(content.query);
  }

  if (tsquery) assertValidTsQueryString(tsquery);
  return tsquery;
}

async function buildJiebaOperatorTsQuery(raw: string): Promise<string> {
  // Warm jieba once; if load failed, whole query uses char-mode.
  await segmentForFts(raw);
  if (!isJiebaLoaded()) {
    return buildCharModeTsQuery(raw);
  }

  const segments = parseFtsOperatorQuery(raw);
  const output: string[] = [];

  for (const seg of segments) {
    if (seg.type === "op") {
      output.push(seg.op);
      continue;
    }
    const content = await extractContentWords(seg.tokens.join(" "));
    const segmented = await segmentForFts(content.query);
    const part = buildJiebaGroupTsQuery(segmented);
    if (part) output.push(part);
  }

  return output.join(" ");
}

export { buildCharModeTsQuery, buildJiebaModeTsQuery } from "./query-char.ts";
