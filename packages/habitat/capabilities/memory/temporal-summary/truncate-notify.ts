import { cstDateString } from "./buckets.ts";

/** source_ref prefix for system-section truncation Inbox rows */
export const TEMPORAL_SUMMARY_SYSTEM_TRUNCATED_SOURCE_PREFIX =
  "temporal_summary:system_truncated" as const;

/** Once-per-CST-day dedupe key for truncation warnings. */
export function temporalSummarySystemTruncatedSourceRef(nowMs: number = Date.now()): string {
  return `${TEMPORAL_SUMMARY_SYSTEM_TRUNCATED_SOURCE_PREFIX}:${cstDateString(nowMs)}`;
}
