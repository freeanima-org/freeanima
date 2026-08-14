import type { DeepSleepMode } from "@freeanima/habitat/capabilities/memory/reflect/types";
import { isCstMonday } from "@freeanima/habitat/core/util";

import type { MaintenanceTrigger } from "./memory-maintenance.ts";

export type ReflectModeCtx = {
  day?: string;
  trigger?: MaintenanceTrigger;
  /** 显式 Reflect 模式（原 deep_sleep_mode） */
  reflect_mode?: DeepSleepMode;
  /** @deprecated 仅兼容旧测试/调用 */
  deep_sleep_mode?: DeepSleepMode;
};

/**
 * 定时 memory-maintenance：仅 CST 周一跑 reflect / self-refresh；其余日跳过。
 * 手动 / catch_up / 显式 step 不跳过。
 */
export function shouldSkipScheduledReflect(ctx: {
  day?: string;
  trigger?: MaintenanceTrigger;
}): boolean {
  if (ctx.trigger !== "scheduled") return false;
  const day = typeof ctx.day === "string" ? ctx.day : undefined;
  if (!day) return true;
  return !isCstMonday(day);
}

/** 解析 reflect 模式（契约字段 `reflect_mode`） */
export function resolveReflectMode(ctx: ReflectModeCtx): DeepSleepMode {
  const explicit = ctx.reflect_mode ?? ctx.deep_sleep_mode;
  if (explicit === "full" || explicit === "incremental") return explicit;
  if (ctx.trigger === "scheduled") {
    const day = typeof ctx.day === "string" ? ctx.day : undefined;
    if (day && isCstMonday(day)) return "full";
    return "incremental";
  }
  return "full";
}
