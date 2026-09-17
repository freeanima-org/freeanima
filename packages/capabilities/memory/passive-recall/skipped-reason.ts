import type { PassiveRecallDebugTrace } from "./debug-types.ts";

/** Classify empty final hits using stage tables when debug was collected. */
export function classifyPassiveRecallNoHits(debug: PassiveRecallDebugTrace): string {
  if (debug.merged.length === 0) return "no_hits";
  if (debug.after_score_filter.length === 0) return "filtered_by_score";
  if (
    (debug.excluded_current_conversation_ids?.length ?? 0) > 0 &&
    debug.after_resident_filter.length === 0
  ) {
    return "filtered_by_current_conversation";
  }
  if (debug.after_resident_filter.length === 0) return "filtered_by_resident";
  return "no_hits_after_filters";
}
