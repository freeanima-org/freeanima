import { conversationGoalSchema, type ConversationGoal } from "@freeanima/core/db/domain";
import type { ConversationPort } from "@freeanima/core/tool/conversation-port.ts";

import { DEFAULT_GOAL_MAX_TURNS } from "./prompts.ts";
import { clearConversationGoal, patchConversationGoal, readConversationGoal } from "./store.ts";

function nowIso(): string {
  return new Date().toISOString();
}

export async function setConversationGoal(
  conversation: ConversationPort,
  conversationId: string,
  description: string,
  maxTurns = DEFAULT_GOAL_MAX_TURNS,
): Promise<ConversationGoal> {
  const goal = conversationGoalSchema.parse({
    description: description.trim(),
    subgoals: [],
    status: "active",
    turn_count: 0,
    max_turns: maxTurns,
    set_at: nowIso(),
  });
  await patchConversationGoal(conversation, conversationId, goal);
  return goal;
}

export async function pauseConversationGoal(
  conversation: ConversationPort,
  conversationId: string,
): Promise<ConversationGoal | null> {
  const goal = await readConversationGoal(conversation, conversationId);
  if (!goal || goal.status !== "active") return goal;
  const next = conversationGoalSchema.parse({ ...goal, status: "paused" });
  await patchConversationGoal(conversation, conversationId, next);
  return next;
}

export async function resumeConversationGoal(
  conversation: ConversationPort,
  conversationId: string,
): Promise<ConversationGoal | null> {
  const goal = await readConversationGoal(conversation, conversationId);
  if (!goal || goal.status !== "paused") return goal;
  const next = conversationGoalSchema.parse({ ...goal, status: "active" });
  await patchConversationGoal(conversation, conversationId, next);
  return next;
}

export async function clearGoal(
  conversation: ConversationPort,
  conversationId: string,
): Promise<void> {
  await clearConversationGoal(conversation, conversationId);
}

export async function addSubgoal(
  conversation: ConversationPort,
  conversationId: string,
  condition: string,
): Promise<ConversationGoal | null> {
  const goal = await readConversationGoal(conversation, conversationId);
  if (!goal) return null;
  const trimmed = condition.trim();
  if (!trimmed) return goal;
  const next = conversationGoalSchema.parse({
    ...goal,
    subgoals: [...goal.subgoals, trimmed],
  });
  await patchConversationGoal(conversation, conversationId, next);
  return next;
}

export async function removeSubgoal(
  conversation: ConversationPort,
  conversationId: string,
  index1Based: number,
): Promise<ConversationGoal | null> {
  const goal = await readConversationGoal(conversation, conversationId);
  if (!goal) return null;
  const idx = index1Based - 1;
  if (idx < 0 || idx >= goal.subgoals.length) return goal;
  const subgoals = goal.subgoals.filter((_, i) => i !== idx);
  const next = conversationGoalSchema.parse({ ...goal, subgoals });
  await patchConversationGoal(conversation, conversationId, next);
  return next;
}

export async function clearSubgoals(
  conversation: ConversationPort,
  conversationId: string,
): Promise<ConversationGoal | null> {
  const goal = await readConversationGoal(conversation, conversationId);
  if (!goal) return null;
  const next = conversationGoalSchema.parse({ ...goal, subgoals: [] });
  await patchConversationGoal(conversation, conversationId, next);
  return next;
}

export function formatGoalStatus(goal: ConversationGoal): string {
  const lines = [
    `**Goal status:** \`${goal.status}\``,
    `• Description: ${goal.description}`,
    `• Turns: ${goal.turn_count}/${goal.max_turns}`,
  ];
  if (goal.subgoals.length > 0) {
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

export function formatSubgoalList(goal: ConversationGoal): string {
  if (goal.subgoals.length === 0) return "No subgoals.";
  return goal.subgoals.map((sg, i) => `${i + 1}. ${sg}`).join("\n");
}
