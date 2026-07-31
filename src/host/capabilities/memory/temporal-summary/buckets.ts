import { createHash } from "node:crypto";
import { CST_OFFSET_MS } from "@freeanima/host/core/util";

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

export function monthPeriodStart(cstDate: string): string {
  return `${cstDate.slice(0, 7)}-01`;
}

export function yearPeriodStart(cstDate: string): string {
  return `${cstDate.slice(0, 4)}-01-01`;
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
