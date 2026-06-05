/** 进程内 L1 PG 诊断：`ANIMA_L1_PG_PROFILE=1` 时统计 op 次数与耗时 */

import { logComponent } from "@freeanima/service-logging";

type ProfileEntry = {
  op: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastBytes?: number;
};

const stats = new Map<string, ProfileEntry>();

export function pgProfileEnabled(): boolean {
  return process.env.ANIMA_L1_PG_PROFILE === "1";
}

export function pgProfileRecord(
  op: string,
  durationMs: number,
  extra?: { bytes?: number; sessionId?: string },
): void {
  if (!pgProfileEnabled()) return;
  let e = stats.get(op);
  if (!e) {
    e = { op, count: 0, totalMs: 0, maxMs: 0 };
    stats.set(op, e);
  }
  e.count += 1;
  e.totalMs += durationMs;
  e.maxMs = Math.max(e.maxMs, durationMs);
  if (extra?.bytes != null) e.lastBytes = extra.bytes;
  if (extra?.sessionId) {
    logComponent("db").debug(
      `${op} ${durationMs.toFixed(1)}ms session=${extra.sessionId}` +
        (extra.bytes != null ? ` bytes=${extra.bytes}` : ""),
      {
        op,
        ms: durationMs,
        session_id: extra.sessionId,
        ...(extra.bytes != null ? { bytes: extra.bytes } : {}),
      },
    );
  }
}

export async function pgProfileWrap<T>(
  op: string,
  fn: () => Promise<T>,
  extra?: { sessionId?: string; resultBytes?: (r: T) => number },
): Promise<T> {
  if (!pgProfileEnabled()) return fn();
  const t0 = performance.now();
  const result = await fn();
  const ms = performance.now() - t0;
  const bytes = extra?.resultBytes?.(result);
  pgProfileRecord(op, ms, { sessionId: extra?.sessionId, bytes });
  return result;
}

export function pgProfileSummary(): Record<string, ProfileEntry> {
  const out: Record<string, ProfileEntry> = {};
  for (const [k, v] of stats) out[k] = { ...v };
  return out;
}

export function pgProfileReset(): void {
  stats.clear();
}

export function pgProfileLogSummary(): void {
  if (!pgProfileEnabled() || stats.size === 0) return;
  const lines = [...stats.values()]
    .toSorted((a, b) => b.totalMs - a.totalMs)
    .map(
      (e) =>
        `${e.op}: count=${e.count} total=${e.totalMs.toFixed(0)}ms max=${e.maxMs.toFixed(0)}ms` +
        (e.lastBytes != null ? ` lastBytes=${e.lastBytes}` : ""),
    );
  logComponent("db").debug(`summary\n${lines.join("\n")}`, { op_count: stats.size });
}
