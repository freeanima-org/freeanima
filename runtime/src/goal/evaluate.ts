import { isSessionMeta, type SessionMessage } from "@freeanima/core/db/domain";
import { parseAwaitingClarify, sessionGoalSchema } from "@freeanima/core/db/domain";
import type { AnimaConfig } from "@freeanima/core/config";
import { getProfileHopModel } from "@freeanima/core/config";
import { judgeGoal } from "@freeanima/core/llm/goal-judge";
import { PROFILE_GOAL_JUDGE } from "@freeanima/core/provider";
import type { SessionConversationPort } from "@freeanima/core/tool/session-conversation-port";
import type { LlmRuntime } from "@freeanima/core/llm";

import {
  formatGoalAchievedMessage,
  formatGoalContinuePrompt,
  formatGoalExhaustedMessage,
} from "./prompts.ts";
import { patchSessionGoal, readSessionGoal } from "./store.ts";

export type GoalRuntimeDeps = {
  conversation: SessionConversationPort;
  llm: LlmRuntime;
  config: AnimaConfig;
};

export type GoalEvaluateResult =
  | { action: "stop"; displayHint?: string }
  | { action: "continue"; continuePrompt: string; displayHint?: string };

function lastAssistantText(msgs: SessionMessage[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "assistant") {
      const content = m.content;
      return typeof content === "string" ? content : "";
    }
  }
  return "";
}

function buildRecentContext(msgs: SessionMessage[], limit = 4): string {
  const lines: string[] = [];
  for (const msg of msgs.slice(-limit)) {
    if (msg.role === "user" || msg.role === "assistant") {
      const content = typeof msg.content === "string" ? msg.content : "";
      if (content.trim()) {
        lines.push(`${msg.role}: ${content.trim().slice(0, 500)}`);
      }
    }
  }
  return lines.join("\n");
}

export async function shouldSkipGoalEvaluate(
  deps: GoalRuntimeDeps,
  sessionId: string,
  _msgs: SessionMessage[],
): Promise<boolean> {
  const meta = await deps.conversation.loadSessionMeta(sessionId);
  if (isSessionMeta(meta) && parseAwaitingClarify(meta.awaiting_clarify)) {
    return true;
  }
  return false;
}

export async function evaluateGoalAfterTurn(
  deps: GoalRuntimeDeps,
  sessionId: string,
  msgs: SessionMessage[],
): Promise<GoalEvaluateResult> {
  const goal = await readSessionGoal(deps.conversation, sessionId);
  if (!goal) return { action: "stop" };
  if (goal.status === "paused" || goal.status === "completed" || goal.status === "exhausted") {
    return { action: "stop" };
  }

  if (goal.turn_count >= goal.max_turns) {
    const exhausted = sessionGoalSchema.parse({
      ...goal,
      status: "exhausted",
      last_judge_reason: formatGoalExhaustedMessage(goal.max_turns),
    });
    await patchSessionGoal(deps.conversation, sessionId, exhausted);
    return {
      action: "stop",
      displayHint: formatGoalExhaustedMessage(goal.max_turns),
    };
  }

  const assistantReply = lastAssistantText(msgs);
  const model = getProfileHopModel(deps.config, PROFILE_GOAL_JUDGE);
  const judge = await judgeGoal(
    {
      goal: goal.description,
      subgoals: goal.subgoals,
      assistantReply,
      recentContext: buildRecentContext(msgs),
    },
    { runtime: deps.llm, model },
  );

  let done = false;
  let reason = "";
  if (judge.ok) {
    done = judge.done;
    reason = judge.reason;
  } else {
    reason = judge.error;
  }

  if (done) {
    const completed = sessionGoalSchema.parse({
      ...goal,
      status: "completed",
      last_judge_reason: reason,
      completed_at: new Date().toISOString(),
    });
    await patchSessionGoal(deps.conversation, sessionId, completed);
    return {
      action: "stop",
      displayHint: formatGoalAchievedMessage(reason),
    };
  }

  const nextCount = goal.turn_count + 1;
  const updated = sessionGoalSchema.parse({
    ...goal,
    turn_count: nextCount,
    last_judge_reason: reason,
  });
  await patchSessionGoal(deps.conversation, sessionId, updated);

  if (nextCount >= goal.max_turns) {
    const exhausted = sessionGoalSchema.parse({
      ...updated,
      status: "exhausted",
    });
    await patchSessionGoal(deps.conversation, sessionId, exhausted);
    return {
      action: "stop",
      displayHint: formatGoalExhaustedMessage(goal.max_turns),
    };
  }

  const continuePrompt = formatGoalContinuePrompt(nextCount, goal.max_turns, reason);
  return {
    action: "continue",
    continuePrompt,
    displayHint: continuePrompt,
  };
}

export function toGoalRuntimeDeps(deps: {
  conversation: SessionConversationPort;
  engine: { llm: LlmRuntime; config: { data: AnimaConfig } };
}): GoalRuntimeDeps {
  return {
    conversation: deps.conversation,
    llm: deps.engine.llm,
    config: deps.engine.config.data,
  };
}
