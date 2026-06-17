import type { ScreenPoint } from "@/lib/window-metrics.ts";

export const IDLE_PATROL_DELAY_MS = 180_000;
export const PATROL_SPEED_PX = 95;
export const MIN_JOURNEY_MS = 1200;
export const PATROL_PAUSE_MS = 10_000;

/** 是否应在空闲计时后开启巡逻 */
export function shouldEnablePatrol(
  lastInteractionAt: number,
  nowMs: number,
  patrolling: boolean,
  modelReady: boolean,
): boolean {
  if (!modelReady || patrolling) return false;
  return nowMs - lastInteractionAt >= IDLE_PATROL_DELAY_MS;
}

/** 匀速巡逻：线性插值位置 */
export function interpolateJourneyPoint(
  from: ScreenPoint,
  to: ScreenPoint,
  t: number,
): ScreenPoint {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    x: Math.round(from.x + (to.x - from.x) * clamped),
    y: Math.round(from.y + (to.y - from.y) * clamped),
  };
}

/** 按恒定速度计算段时长（ms） */
export function journeyDurationMs(distancePx: number, speedPxPerSec = PATROL_SPEED_PX): number {
  const bySpeed = (distancePx / speedPxPerSec) * 1000;
  return Math.max(MIN_JOURNEY_MS, bySpeed);
}
