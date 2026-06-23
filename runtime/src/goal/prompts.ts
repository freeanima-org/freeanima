export const DEFAULT_GOAL_MAX_TURNS = 20;

export const GOAL_START_PREFIX = "[Goal]";

export function formatGoalStartPrompt(description: string): string {
  return `${GOAL_START_PREFIX} 开始执行目标：${description.trim()}`;
}

export function formatGoalContinuePrompt(
  turnCount: number,
  maxTurns: number,
  reason: string,
): string {
  return `↻ Continuing toward goal (${turnCount}/${maxTurns}): ${reason.trim()}`;
}

export function formatGoalAchievedMessage(reason: string): string {
  return `✓ Goal achieved: ${reason.trim()}`;
}

export function formatGoalExhaustedMessage(maxTurns: number): string {
  return `⊙ Goal turn budget exhausted (${maxTurns}/${maxTurns})`;
}

export function formatGoalSetMessage(maxTurns: number): string {
  return `⊙ Goal set (${maxTurns}-turn budget)`;
}
