export const DEFAULT_GOAL_MAX_CONTINUES = 20;

export const GOAL_START_PREFIX = "[Goal]";

export function formatGoalStartPrompt(description: string): string {
  return `${GOAL_START_PREFIX} 开始执行目标：${description.trim()}`;
}

export function formatGoalContinuePrompt(
  continueCount: number,
  maxContinues: number,
  reason: string,
): string {
  return `↻ Continuing toward goal (${continueCount}/${maxContinues}): ${reason.trim()}`;
}

export function formatGoalAchievedMessage(reason: string): string {
  return `✓ Goal achieved: ${reason.trim()}`;
}

export function formatGoalExhaustedMessage(maxContinues: number): string {
  return `⊙ Goal continue budget exhausted (${maxContinues}/${maxContinues})`;
}

/** Judge 调用/解析失败：暂停自动续跑，避免装死（active 但不续跑） */
export function formatGoalJudgeFailedMessage(error: string): string {
  const detail = error.trim() || "unknown error";
  return `⊙ Goal paused: judge failed (${detail}). Use \`/goal resume\` to retry.`;
}

export function formatGoalSetMessage(maxContinues: number): string {
  return `⊙ Goal set (${maxContinues}-continue budget)`;
}
