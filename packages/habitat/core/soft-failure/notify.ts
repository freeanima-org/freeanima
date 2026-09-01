import { CST_OFFSET_MS } from "@freeanima/habitat/core/util";

/** Result of a bypassable soft-failure Inbox attempt. */
export type SoftFailureNotifyResult = "notified" | "deduped" | "skipped";

export type SoftFailureNotifyInput = {
  sourceRef: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  /** Optional log label when the bound impl fails (platform may ignore). */
  logLabel?: string;
  /**
   * 收件范围。默认 both（user+默认 agent）。
   * `user`：仅用户 Inbox，不进 agent 旁侧 `<notification>` 注入（适合「请到卧室点按钮」类）。
   */
  audience?: "both" | "user" | "agent";
};

export type SoftFailureNotifyFn = (
  input: SoftFailureNotifyInput,
) => Promise<SoftFailureNotifyResult>;

let notifyImpl: SoftFailureNotifyFn | null = null;

export function registerSoftFailureNotify(fn: SoftFailureNotifyFn): void {
  notifyImpl = fn;
}

export function unregisterSoftFailureNotify(): void {
  notifyImpl = null;
}

/** CST calendar date YYYY-MM-DD for instant (same calendar as temporal-summary buckets). */
export function cstCalendarDateString(atMs: number = Date.now()): string {
  const cst = new Date(atMs + CST_OFFSET_MS);
  const y = cst.getUTCFullYear();
  const m = cst.getUTCMonth() + 1;
  const d = cst.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Once-per-CST-day dedupe key: `{prefix}:{YYYY-MM-DD}`. */
export function cstDaySourceRef(prefix: string, nowMs: number = Date.now()): string {
  return `${prefix}:${cstCalendarDateString(nowMs)}`;
}

/**
 * Notify user+agent Inbox for a bypassable soft failure (deduped by source_ref).
 * No-op (`skipped`) until platform binds an impl; never throws to callers.
 */
export async function notifySoftFailure(
  input: SoftFailureNotifyInput,
): Promise<SoftFailureNotifyResult> {
  if (!notifyImpl) return "skipped";
  try {
    return await notifyImpl(input);
  } catch {
    return "skipped";
  }
}
