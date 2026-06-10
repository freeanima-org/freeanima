import { isCjkJiebaEnabled } from "@freeanima/service-config";

import { buildCharModeTsQuery, buildJiebaModeTsQuery } from "./query-char.ts";
import { segmentForFts } from "./segment.ts";

/** 按当前 cjk 配置构建 tsquery */
export async function buildFtsTsQuery(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const operators = new Set(["AND", "OR", "NOT"]);
  if ([...operators].some((op) => trimmed.includes(` ${op} `))) {
    return buildCharModeTsQuery(trimmed);
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return buildCharModeTsQuery(trimmed);
  }

  if (isCjkJiebaEnabled()) {
    const segmented = await segmentForFts(trimmed);
    return buildJiebaModeTsQuery(segmented);
  }

  return buildCharModeTsQuery(trimmed);
}

export { buildCharModeTsQuery, buildJiebaModeTsQuery } from "./query-char.ts";
