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

/** Judge 调用/解析失败：暂停自动续跑，避免装死（active 但不续跑） */
export function formatGoalJudgeFailedMessage(error: string): string {
  const detail = error.trim() || "unknown error";
  return `⊙ Goal paused: judge failed (${detail}). Use \`/goal resume\` to retry.`;
}

export function formatGoalSetMessage(maxTurns: number): string {
  return `⊙ Goal set (${maxTurns}-turn budget)`;
}
