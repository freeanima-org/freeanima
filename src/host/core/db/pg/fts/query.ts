import {
  assertValidTsQueryString,
  hasFtsQueryOperators,
  parseFtsOperatorQuery,
  validateFtsQueryInput,
} from "@freeanima/host/core/util";
import { getActiveRuntimeConfig } from "@freeanima/host/core/config";
import { isCjkJiebaEnabled } from "@freeanima/host/core/config/cjk-config";

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

/** Build tsquery from current cjk config */
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
    tsquery = buildCharModeTsQuery(trimmed);
  } else if (isCjkJiebaEnabled(getActiveRuntimeConfig().data)) {
    const segmented = await segmentForFts(trimmed);
    tsquery = tsqueryAfterCjkSegment(trimmed, segmented, isJiebaLoaded());
  } else {
    tsquery = buildCharModeTsQuery(trimmed);
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
    const segmented = await segmentForFts(seg.tokens.join(" "));
    const part = buildJiebaGroupTsQuery(segmented);
    if (part) output.push(part);
  }

  return output.join(" ");
}

export { buildCharModeTsQuery, buildJiebaModeTsQuery } from "./query-char.ts";
