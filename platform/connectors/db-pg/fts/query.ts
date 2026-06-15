import {
  assertValidTsQueryString,
  hasFtsQueryOperators,
  parseFtsOperatorQuery,
  validateFtsQueryInput,
} from "@freeanima/core/util";
import { getActiveConfig, isCjkJiebaEnabled } from "@freeanima/platform/config";

import {
  buildCharModeTsQuery,
  buildJiebaGroupTsQuery,
  buildJiebaModeTsQuery,
} from "./query-char.ts";
import { segmentForFts } from "./segment.ts";

/** Build tsquery from current cjk config */
export async function buildFtsTsQuery(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  validateFtsQueryInput(trimmed);

  let tsquery: string;
  if (hasFtsQueryOperators(trimmed)) {
    if (isCjkJiebaEnabled(getActiveConfig().data)) {
      tsquery = await buildJiebaOperatorTsQuery(trimmed);
    } else {
      tsquery = buildCharModeTsQuery(trimmed);
    }
  } else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    tsquery = buildCharModeTsQuery(trimmed);
  } else if (isCjkJiebaEnabled(getActiveConfig().data)) {
    const segmented = await segmentForFts(trimmed);
    tsquery = buildJiebaModeTsQuery(segmented);
  } else {
    tsquery = buildCharModeTsQuery(trimmed);
  }

  if (tsquery) assertValidTsQueryString(tsquery);
  return tsquery;
}

async function buildJiebaOperatorTsQuery(raw: string): Promise<string> {
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
