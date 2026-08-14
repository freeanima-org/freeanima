import { temporalSummarySystemTruncatedSourceRef } from "@freeanima/habitat/capabilities/memory/temporal-summary";
import { notifySoftFailure } from "@freeanima/habitat/core/soft-failure";

/**
 * When temporal-summary system section was truncated, warn user+agent Inbox.
 * Deduped once per CST day via source_ref.
 */
export async function notifyTemporalSummarySystemTruncated(opts: {
  maxChars: number;
  nowMs?: number;
}): Promise<"notified" | "deduped" | "skipped"> {
  const nowMs = opts.nowMs ?? Date.now();
  const sourceRef = temporalSummarySystemTruncatedSourceRef(nowMs);
  const title = "时间摘要 system 段已截断";
  const body = [
    `时间摘要写入 system prompt 时超过上限（约 ${opts.maxChars} 字），已截断。`,
    "这不是记忆主区；若反复出现，请检查历史日/月/年摘要是否过长，或酌情提高 memory.temporal_summary.system_prompt_max_chars。",
  ].join("\n");

  return notifySoftFailure({
    sourceRef,
    title,
    body,
    payload: { kind: "temporal_summary_system_truncated", max_chars: opts.maxChars },
    logLabel: "temporal_summary_truncate",
  });
}
