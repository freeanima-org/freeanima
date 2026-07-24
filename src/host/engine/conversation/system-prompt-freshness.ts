import { CST_OFFSET_MS } from "@freeanima/host/core/util";

/** CST 日界：与 sleep-cycle 对齐，每日 02:00 */
export const SYSTEM_PROMPT_DAY_BOUNDARY_HOUR_CST = 2;

/**
 * 最近一次 CST 02:00 边界的 UTC epoch ms。
 * 当前时刻若尚未越过今日 02:00，则回退到昨日 02:00。
 */
export function lastSystemPromptBoundaryMs(nowMs: number = Date.now()): number {
  const cst = new Date(nowMs + CST_OFFSET_MS);
  const y = cst.getUTCFullYear();
  const m = cst.getUTCMonth();
  const d = cst.getUTCDate();
  let boundaryUtc = Date.UTC(y, m, d, SYSTEM_PROMPT_DAY_BOUNDARY_HOUR_CST, 0, 0, 0) - CST_OFFSET_MS;
  if (nowMs < boundaryUtc) {
    boundaryUtc -= 24 * 60 * 60 * 1000;
  }
  return boundaryUtc;
}

/** built_at 缺失/无效，或早于最近 CST 02:00 → 需重建 */
export function isSystemPromptStale(
  builtAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (builtAtIso == null || !builtAtIso.trim()) return true;
  const built = Date.parse(builtAtIso);
  if (Number.isNaN(built)) return true;
  return built < lastSystemPromptBoundaryMs(nowMs);
}
