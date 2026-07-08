import { DEFAULT_BEHAVIOR, type CompanionBehavior } from "./types.ts";

export function mergeBehavior(partial?: Partial<CompanionBehavior>): CompanionBehavior {
  return {
    ...DEFAULT_BEHAVIOR,
    ...partial,
  };
}

export function idlePatrolDelayMs(behavior: CompanionBehavior): number {
  return behavior.idle_patrol_delay_sec * 1000;
}

export function patrolPauseMs(behavior: CompanionBehavior): number {
  return behavior.patrol_pause_sec * 1000;
}
