import { getActiveRuntimeConfig } from "@freeanima/host/core/config";
import { isCjkJiebaEnabled } from "@freeanima/host/core/config/cjk-config";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/host/core/soft-failure";
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
    const error = String(err);
    log.warn("fts segmented write skipped", { error });
    void notifySoftFailure({
      sourceRef: cstDaySourceRef("fts:segment_failed"),
      title: "FTS 分词失败",
      body: [
        "CJK jieba 分词写入失败，行仍写入但 fts_segmented 为空，检索质量可能下降。",
        `错误：${error}`,
      ].join("\n"),
      payload: { kind: "fts_segment_failed", error },
      logLabel: "fts",
    });
    return null;
  }
}
