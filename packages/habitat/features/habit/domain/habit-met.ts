import type { HabitPolarity } from "@freeanima/habitat/core/db/schema/entity";

/**
 * 当日是否达标。
 * - build：完成量 ≥ 日目标（无记录未达标）
 * - break：发生量 ≤ 日上限（无记录达标）
 */
export function isHabitDayMet(polarity: HabitPolarity, amount: number, target: number): boolean {
  if (polarity === "break") return amount <= target;
  return amount >= target;
}

/** boolean 模式默认 target：养成 1，戒除 0 */
export function defaultBooleanTarget(polarity: HabitPolarity): number {
  return polarity === "break" ? 0 : 1;
}

/**
 * boolean 记一次后的 amount。
 * 养成：置满 target；戒除：置为 target+1（刚超上限）。
 */
export function booleanCheckInAmount(polarity: HabitPolarity, target: number): number {
  if (polarity === "break") return target + 1;
  return target;
}
