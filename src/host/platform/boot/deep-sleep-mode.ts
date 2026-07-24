import type { DeepSleepMode } from "@freeanima/host/capabilities/memory/deep-sleep/types";
import { isCstMonday } from "@freeanima/host/core/util";
import type { PipelineContext } from "@freeanima/host/engine/pipeline";

/** Resolve deep sleep mode from pipeline context and trigger source */
export function resolveDeepSleepMode(ctx: PipelineContext): DeepSleepMode {
  const explicit = ctx.deep_sleep_mode;
  if (explicit === "full" || explicit === "incremental") return explicit;
  if (ctx.trigger === "scheduled") {
    const day = typeof ctx.day === "string" ? ctx.day : undefined;
    if (day && isCstMonday(day)) return "full";
    return "incremental";
  }
  return "full";
}
