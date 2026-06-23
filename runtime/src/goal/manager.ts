import { sessionGoalSchema, type SessionGoal } from "@freeanima/core/db/domain";
import type { SessionConversationPort } from "@freeanima/core/tool/session-conversation-port";

import { DEFAULT_GOAL_MAX_TURNS } from "./prompts.ts";
import { clearSessionGoal, patchSessionGoal, readSessionGoal } from "./store.ts";

function nowIso(): string {
  return new Date().toISOString();
}

export async function setSessionGoal(
  conversation: SessionConversationPort,
  sessionId: string,
  description: string,
  maxTurns = DEFAULT_GOAL_MAX_TURNS,
): Promise<SessionGoal> {
  const goal = sessionGoalSchema.parse({
    description: description.trim(),
    subgoals: [],
    status: "active",
    turn_count: 0,
    max_turns: maxTurns,
    set_at: nowIso(),
  });
  await patchSessionGoal(conversation, sessionId, goal);
  return goal;
}

export async function pauseSessionGoal(
  conversation: SessionConversationPort,
  sessionId: string,
): Promise<SessionGoal | null> {
  const goal = await readSessionGoal(conversation, sessionId);
  if (!goal || goal.status !== "active") return goal;
  const next = sessionGoalSchema.parse({ ...goal, status: "paused" });
  await patchSessionGoal(conversation, sessionId, next);
  return next;
}

export async function resumeSessionGoal(
  conversation: SessionConversationPort,
  sessionId: string,
): Promise<SessionGoal | null> {
  const goal = await readSessionGoal(conversation, sessionId);
  if (!goal || goal.status !== "paused") return goal;
  const next = sessionGoalSchema.parse({ ...goal, status: "active" });
  await patchSessionGoal(conversation, sessionId, next);
  return next;
}

export async function clearGoal(
  conversation: SessionConversationPort,
  sessionId: string,
): Promise<void> {
  await clearSessionGoal(conversation, sessionId);
}

export async function addSubgoal(
  conversation: SessionConversationPort,
  sessionId: string,
  condition: string,
): Promise<SessionGoal | null> {
  const goal = await readSessionGoal(conversation, sessionId);
  if (!goal) return null;
  const trimmed = condition.trim();
  if (!trimmed) return goal;
  const next = sessionGoalSchema.parse({
    ...goal,
    subgoals: [...goal.subgoals, trimmed],
  });
  await patchSessionGoal(conversation, sessionId, next);
  return next;
}

export async function removeSubgoal(
  conversation: SessionConversationPort,
  sessionId: string,
  index1Based: number,
): Promise<SessionGoal | null> {
  const goal = await readSessionGoal(conversation, sessionId);
  if (!goal) return null;
  const idx = index1Based - 1;
  if (idx < 0 || idx >= goal.subgoals.length) return goal;
  const subgoals = goal.subgoals.filter((_, i) => i !== idx);
  const next = sessionGoalSchema.parse({ ...goal, subgoals });
  await patchSessionGoal(conversation, sessionId, next);
  return next;
}

export async function clearSubgoals(
  conversation: SessionConversationPort,
  sessionId: string,
): Promise<SessionGoal | null> {
  const goal = await readSessionGoal(conversation, sessionId);
  if (!goal) return null;
  const next = sessionGoalSchema.parse({ ...goal, subgoals: [] });
  await patchSessionGoal(conversation, sessionId, next);
  return next;
}

export function formatGoalStatus(goal: SessionGoal): string {
  const lines = [
    `**Goal status:** \`${goal.status}\``,
    `• Description: ${goal.description}`,
    `• Turns: ${goal.turn_count}/${goal.max_turns}`,
  ];
  if (goal.subgoals.length) {
    lines.push("• Subgoals:");
    for (const [i, sg] of goal.subgoals.entries()) {
      lines.push(`  ${i + 1}. ${sg}`);
    }
  }
  if (goal.last_judge_reason) {
    lines.push(`• Last judge: ${goal.last_judge_reason}`);
  }
  return lines.join("\n");
}

export function formatSubgoalList(goal: SessionGoal): string {
  if (!goal.subgoals.length) return "No subgoals.";
  return goal.subgoals.map((sg, i) => `${i + 1}. ${sg}`).join("\n");
}
