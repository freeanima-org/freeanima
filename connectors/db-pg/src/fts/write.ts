import { isCjkJiebaEnabled } from "@freeanima/service-config";

import { segmentForFts } from "./segment.ts";

/** Write fts_segmented column; returns null when jieba disabled */
export async function resolveFtsSegmentedForWrite(content: string): Promise<string | null> {
  if (!isCjkJiebaEnabled()) return null;
  const segmented = await segmentForFts(content);
  return segmented || null;
}
