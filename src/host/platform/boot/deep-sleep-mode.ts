import type { DeepSleepMode } from "@freeanima/host/capabilities/memory/deep-sleep/types";
import { isCstMonday } from "@freeanima/host/core/util";
import type { PipelineContext } from "@freeanima/host/engine/pipeline";

/**
 * 定时 sleep-cycle：仅 CST 周一跑深睡；其余日跳过。
 * 手动 / catch_up / 显式 step 不跳过。
 */
export function shouldSkipScheduledDeepSleep(ctx: PipelineContext): boolean {
  if (ctx.trigger !== "scheduled") return false;
  const day = typeof ctx.day === "string" ? ctx.day : undefined;
  if (!day) return true;
  return !isCstMonday(day);
}

/** Resolve deep sleep mode from pipeline context and trigger source */
export function resolveDeepSleepMode(ctx: PipelineContext): DeepSleepMode {
  const explicit = ctx.deep_sleep_mode;
  if (explicit === "full" || explicit === "incremental") return explicit;
  if (ctx.trigger === "scheduled") {
    const day = typeof ctx.day === "string" ? ctx.day : undefined;
    if (day && isCstMonday(day)) return "full";
    // 非周一 scheduled 应由 skipIf 跳过；若仍进入 handler 则用 incremental
    return "incremental";
  }
  return "full";
}
