import { getActiveRuntimeConfig } from "@freeanima/host/core/config";
import { isCjkJiebaEnabled } from "@freeanima/host/core/config/cjk-config";
import { logPgComponent } from "../log.ts";

import { isJiebaLoaded, segmentForFts } from "./segment.ts";

const log = logPgComponent("fts");

/** Write fts_segmented column; returns null when jieba disabled or on failure */
export async function resolveFtsSegmentedForWrite(content: string): Promise<string | null> {
  let cfg;
  try {
    cfg = getActiveRuntimeConfig().data;
  } catch {
    return null;
  }
  if (!isCjkJiebaEnabled(cfg)) return null;
  try {
    const segmented = await segmentForFts(content);
    // jieba enabled but load failed: segmentForFts returns raw text — do not store as segmented
    if (!isJiebaLoaded()) return null;
    return segmented || null;
  } catch (err) {
    log.warn("fts segmented write skipped", { error: String(err) });
    return null;
  }
}
