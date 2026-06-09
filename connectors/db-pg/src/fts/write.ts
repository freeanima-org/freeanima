import { isCjkJiebaEnabled } from "@freeanima/service-config";

import { segmentForFts } from "./segment.ts";

/** 写入 fts_segmented 列；关 jieba 时返回 null */
export async function resolveFtsSegmentedForWrite(content: string): Promise<string | null> {
  if (!isCjkJiebaEnabled()) return null;
  const segmented = await segmentForFts(content);
  return segmented || null;
}
