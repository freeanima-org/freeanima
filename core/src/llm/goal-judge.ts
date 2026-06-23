import { PROFILE_GOAL_JUDGE } from "@freeanima/core/provider";
import { chat } from "./llm.ts";
import type { LlmRuntime } from "./llm-stack.ts";

export const GOAL_JUDGE_SYSTEM_PROMPT = `You are a strict goal-completion judge for an AI agent session.

Given the session goal, optional subgoals, recent conversation excerpt, and the agent's latest assistant reply, decide whether the goal is DONE.

Conservative rules — only mark done when there is clear evidence:
- PASS (done=true): the assistant explicitly confirms completion, clearly presents final deliverables, or states the goal is blocked / impossible / needs user input (explain the blocker in reason).
- FAIL (done=false): progress only, vague implications, plans without execution, or missing concrete evidence (file contents, command output, published links, etc.).

Output ONLY valid JSON with no markdown fences:
{"done": true|false, "reason": "brief explanation in the same language as the goal"}`;

export type GoalJudgeInput = {
  goal: string;
  subgoals: string[];
  assistantReply: string;
  recentContext?: string;
};

export type GoalJudgeResult =
  | { ok: true; done: boolean; reason: string }
  | { ok: false; error: string };

const GOAL_JUDGE_JSON_SCHEMA = {
  done: "boolean",
  reason: "string",
} as const;

function formatGoalJudgeUser(input: GoalJudgeInput): string {
  const lines = [`Goal: ${input.goal}`];
  if (input.subgoals.length) {
    lines.push("Subgoals:");
    for (const [i, sg] of input.subgoals.entries()) {
      lines.push(`  ${i + 1}. ${sg}`);
    }
  }
  if (input.recentContext?.trim()) {
    lines.push("", "Recent context:", input.recentContext.trim());
  }
  lines.push("", "Latest assistant reply:", input.assistantReply.trim() || "(empty)");
  return lines.join("\n");
}

export function parseGoalJudgeOutput(raw: string): GoalJudgeResult {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ok: false, error: "judge output is not JSON" };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (typeof parsed.done !== "boolean") {
      return { ok: false, error: "judge JSON missing boolean done" };
    }
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    if (!reason) {
      return { ok: false, error: "judge JSON missing reason" };
    }
    return { ok: true, done: parsed.done, reason };
  } catch (e) {
    return { ok: false, error: `judge JSON parse error: ${e}` };
  }
}

export async function judgeGoal(
  input: GoalJudgeInput,
  opts?: { runtime?: LlmRuntime; model?: string },
): Promise<GoalJudgeResult> {
  if (!input.goal.trim()) {
    return { ok: false, error: "empty goal" };
  }
  try {
    const resp = await chat(
      [
        { role: "system", content: GOAL_JUDGE_SYSTEM_PROMPT },
        { role: "user", content: formatGoalJudgeUser(input) },
      ],
      {
        profileId: PROFILE_GOAL_JUDGE,
        runtime: opts?.runtime,
        model: opts?.model,
        requestParams: { maxOutputTokens: 256, temperature: 0.2 },
      },
    );
    return parseGoalJudgeOutput(String(resp.content ?? ""));
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** @internal exported for tests */
export const goalJudgeJsonFields = GOAL_JUDGE_JSON_SCHEMA;
