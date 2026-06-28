import { getActiveConfig, isCjkJiebaEnabled } from "@freeanima/core/config";
import { logPgComponent } from "../log.ts";

import { segmentForFts } from "./segment.ts";

const log = logPgComponent("fts");

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
