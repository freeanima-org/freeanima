import { getActiveConfig, isCjkJiebaEnabled } from "@freeanima/platform/config";

import { segmentForFts } from "./segment.ts";

/** Write fts_segmented column; returns null when jieba disabled */
export async function resolveFtsSegmentedForWrite(content: string): Promise<string | null> {
  if (!isCjkJiebaEnabled(getActiveConfig().data)) return null;
  const segmented = await segmentForFts(content);
  return segmented || null;
}
