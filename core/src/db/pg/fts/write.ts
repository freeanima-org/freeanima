import { getActiveConfig, isCjkJiebaEnabled } from "@freeanima/core/config";
import { logPgComponent } from "../log.ts";

import { segmentForFts } from "./segment.ts";

const log = logPgComponent("fts");

/** Write fts_segmented column; returns null when jieba disabled or on failure */
export async function resolveFtsSegmentedForWrite(content: string): Promise<string | null> {
  let cfg;
  try {
    cfg = getActiveConfig().data;
  } catch {
    return null;
  }
  if (!isCjkJiebaEnabled(cfg)) return null;
  try {
    const segmented = await segmentForFts(content);
    return segmented || null;
  } catch (err) {
    log.warn("fts segmented write skipped", { error: String(err) });
    return null;
  }
}
