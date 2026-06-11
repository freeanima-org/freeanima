/** Millisecond offset of CST (+8) from UTC */
export const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Current instant as CST ISO 8601 string (+08:00) */
export function formatCstIso(date: Date = new Date()): string {
  return new Date(date.getTime() + CST_OFFSET_MS).toISOString().replace("Z", "+08:00");
}

/** Unix epoch seconds → CST ISO string truncated to minute precision (no subseconds) */
export function formatCstIsoFromEpoch(epochSec: number): string {
  if (epochSec <= 0) return "";
  return formatCstIso(new Date(epochSec * 1000)).slice(0, 19);
}
