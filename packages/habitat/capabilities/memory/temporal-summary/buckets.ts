import { createHash } from "node:crypto";
import { CST_OFFSET_MS } from "@freeanima/habitat/core/util";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Half-hour bucket start as CST ISO with +08:00, e.g. 2026-07-18T06:00+08:00 */
export function temporalBucketStartIso(atMs: number = Date.now()): string {
  const cst = new Date(atMs + CST_OFFSET_MS);
  const y = cst.getUTCFullYear();
  const m = cst.getUTCMonth();
  const d = cst.getUTCDate();
  const h = cst.getUTCHours();
  const min = cst.getUTCMinutes() < 30 ? 0 : 30;
  return `${y}-${pad2(m + 1)}-${pad2(d)}T${pad2(h)}:${pad2(min)}+08:00`;
}

export function temporalBucketEndIso(bucketStartIso: string): string {
  const startMs = Date.parse(bucketStartIso);
  if (Number.isNaN(startMs)) throw new Error(`invalid bucket: ${bucketStartIso}`);
  // 桶结束 = 下一半小时桶起点；须走 temporalBucketStartIso，勿把 UTC toISOString 的 Z 直接换成 +08:00
  return temporalBucketStartIso(startMs + 30 * 60 * 1000);
}

/** CST calendar date YYYY-MM-DD for instant */
export function cstDateString(atMs: number = Date.now()): string {
  const cst = new Date(atMs + CST_OFFSET_MS);
  const y = cst.getUTCFullYear();
  const m = cst.getUTCMonth() + 1;
  const d = cst.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** CST day start as +08:00 ISO, e.g. 2026-07-18T00:00:00+08:00 */
export function cstDayStartIso(atMs: number = Date.now()): string {
  return `${cstDateString(atMs)}T00:00:00+08:00`;
}

/**
 * Lower bound for tick material: max(watermark, CST day start).
 * Prevents cross-day history dump when day rolls and watermark resets.
 */
export function temporalMaterialAfterAt(
  watermarkAt: string | undefined,
  dayStartIso: string,
): string {
  const dayMs = Date.parse(dayStartIso);
  const wmMs = watermarkAt ? Date.parse(watermarkAt) : Number.NaN;
  if (Number.isNaN(dayMs)) return watermarkAt ?? dayStartIso;
  if (Number.isNaN(wmMs) || watermarkAt == null) return dayStartIso;
  return wmMs >= dayMs ? watermarkAt : dayStartIso;
}

/** Closed half-hour buckets for cst_date whose end <= now */
export function listClosedBucketsToday(nowMs: number = Date.now()): string[] {
  const date = cstDateString(nowMs);
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const min of [0, 30]) {
      const bucket = `${date}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}+08:00`;
      const endMs = Date.parse(temporalBucketEndIso(bucket));
      if (endMs <= nowMs) out.push(bucket);
    }
  }
  return out;
}

export type PeerRollSource = {
  conversation_id: string;
  at: string;
  summary: string;
};

/** Canonical fingerprint for Redis peer_roll key */
export function peerRollSourcesFp(sources: PeerRollSource[]): string {
  const sorted = sources.toSorted((a, b) => {
    const c = a.conversation_id.localeCompare(b.conversation_id);
    if (c !== 0) return c;
    return a.at.localeCompare(b.at);
  });
  const payload = JSON.stringify(
    sorted.map((s) => ({
      conversation_id: s.conversation_id,
      at: s.at,
      summary: s.summary,
    })),
  );
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function peerRollRedisKey(opts: {
  prefix: string;
  cst_date: string;
  bucket: string;
  sources_fp: string;
}): string {
  const bucketToken = opts.bucket.replaceAll("+", "_");
  return `${opts.prefix}:peer_roll:${opts.cst_date}:${bucketToken}:${opts.sources_fp}`;
}

/** Fingerprint for system prompt rollup source rows */
export function sysRollSourcesFp(
  rows: ReadonlyArray<{ period_start: string; content: string }>,
): string {
  const sorted = rows.toSorted((a, b) => a.period_start.localeCompare(b.period_start));
  const payload = JSON.stringify(
    sorted.map((r) => ({ period_start: r.period_start, content: r.content.trim() })),
  );
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export type SysRollKind = "past_days" | "past_months" | "past_years";

/** Stable Redis key（按 agent world 分桶；无 fp，Habitat UI 可列缓存槽） */
export function sysRollRedisKey(opts: {
  prefix: string;
  kind: SysRollKind;
  /** past_days → today; past_months → yyyy-mm; past_years → yyyy */
  anchor: string;
  /** agent 私有 world_id */
  world_id: number;
}): string {
  return `${opts.prefix}:sys_roll:w${opts.world_id}:${opts.kind}:${opts.anchor}`;
}

export function monthPeriodStart(cstDate: string): string {
  return `${cstDate.slice(0, 7)}-01`;
}

export function yearPeriodStart(cstDate: string): string {
  return `${cstDate.slice(0, 4)}-01-01`;
}

/** Previous calendar month period_start (YYYY-MM-01) relative to a month-start date. */
export function previousMonthPeriodStart(monthStart: string): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthStart;
  if (m === 1) return `${y - 1}-12-01`;
  return `${y}-${pad2(m - 1)}-01`;
}

/** Last CST calendar day of the month containing period_start (YYYY-MM-01). */
export function lastDayOfMonthPeriod(period_start: string): string {
  const y = Number(period_start.slice(0, 4));
  const m = Number(period_start.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return period_start;
  const last = new Date(Date.UTC(y, m, 0));
  return `${y}-${pad2(m)}-${pad2(last.getUTCDate())}`;
}

export function isCstMonthStart(cstDate: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(cstDate);
}

export function isCstYearStart(cstDate: string): boolean {
  return /^\d{4}-01-01$/.test(cstDate);
}

export function isCstMonthEnd(cstDate: string): boolean {
  const [y, m, d] = cstDate.split("-").map(Number);
  if (y == null || m == null || d == null) return false;
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.getUTCMonth() !== m - 1;
}

export function isCstYearEnd(cstDate: string): boolean {
  return cstDate.endsWith("-12-31");
}
