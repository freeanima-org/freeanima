import { getActiveConfig, isCjkJiebaEnabled } from "@freeanima/platform/config";
import { logComponent } from "@freeanima/platform/logging";

import { segmentForFts } from "./segment.ts";

const log = logComponent("fts");

/** Write fts_segmented column; returns null when jieba disabled or on failure */
export async function resolveFtsSegmentedForWrite(content: string): Promise<string | null> {
  if (!isCjkJiebaEnabled(getActiveConfig().data)) return null;
  try {
    const segmented = await segmentForFts(content);
    return segmented || null;
  } catch (err) {
    log.warn("fts segmented write skipped", { error: String(err) });
    return null;
  }
}
