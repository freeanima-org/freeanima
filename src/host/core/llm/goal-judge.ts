import { omitUndefined } from "@freeanima/host/core/util";
import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import { PROFILE_GOAL_JUDGE } from "@freeanima/host/core/provider";
import { runAutoLlmChat } from "./auto-llm-chat.ts";
import type { LlmRuntime } from "./llm-stack.ts";

export const AUTO_LLM_RUN_KIND_GOAL_JUDGE = "goal-judge";

export const GOAL_JUDGE_SYSTEM_PROMPT = `You are a strict goal-completion judge for an AI agent conversation.

Given the conversation goal, optional subgoals, recent conversation excerpt, and the agent's latest assistant reply, decide whether the goal is DONE.

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

/**
 * OpenAI-compatible JSON mode（经 params.extra 透传）。
 * 关闭 thinking：短 JSON 判定不需要推理，且 thinking 常与 content 共用 max_tokens。
 * tool_choice none：一次性 completion，禁止 tool call。
 * maxOutputTokens 仍留余量，兼容忽略 thinking 开关的网关。
 */
export const GOAL_JUDGE_REQUEST_PARAMS = {
  maxOutputTokens: 2048,
  temperature: 0.2,
  extra: {
    response_format: { type: "json_object" },
    thinking: { type: "disabled" },
    tool_choice: "none",
  },
} as const;

function formatGoalJudgeUser(input: GoalJudgeInput): string {
  const lines = [`Goal: ${input.goal}`];
  if (input.subgoals.length > 0) {
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

function stripJudgeWrappers(raw: string): string {
  let text = raw.trim();
  // ```json ... ``` or ``` ... ```
  const fenced = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(text);
  if (fenced?.[1] !== undefined) {
    text = fenced[1].trim();
  }
  // '''...''' or """..."""
  if (
    (text.startsWith("'''") && text.endsWith("'''") && text.length >= 6) ||
    (text.startsWith('"""') && text.endsWith('"""') && text.length >= 6)
  ) {
    text = text.slice(3, -3).trim();
  }
  return text;
}

export function parseGoalJudgeOutput(raw: string): GoalJudgeResult {
  const trimmed = stripJudgeWrappers(raw);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    const preview = trimmed.replace(/\s+/g, " ").slice(0, 80);
    return {
      ok: false,
      error: preview ? `judge output is not JSON: ${preview}` : "judge output is not JSON",
    };
  }
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof parsed.done !== "boolean") {
      return { ok: false, error: "judge JSON missing boolean done" };
    }
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    if (!reason) {
      return { ok: false, error: "judge JSON missing reason" };
    }
    return { ok: true, done: parsed.done, reason };
  } catch (e) {
    return {
      ok: false,
      error: `judge JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function judgeGoal(
  input: GoalJudgeInput,
  opts?: { runtime?: LlmRuntime; model?: string; parentConversationId?: string },
): Promise<GoalJudgeResult> {
  if (!input.goal.trim()) {
    return { ok: false, error: "empty goal" };
  }
  try {
    const chatMessages = [
      { role: "system" as const, content: GOAL_JUDGE_SYSTEM_PROMPT },
      { role: "user" as const, content: formatGoalJudgeUser(input) },
    ];
    const recorded = await runAutoLlmChat(
      omitUndefined({
        runName: opts?.parentConversationId
          ? `goal-judge:${opts.parentConversationId}`
          : "goal-judge",
        runKind: AUTO_LLM_RUN_KIND_GOAL_JUDGE,
        subjectId: getResolvedWorldContext().agent_subject_id,
        messages: chatMessages,
        profileId: PROFILE_GOAL_JUDGE,
        runtime: opts?.runtime,
        model: opts?.model,
        requestParams: { ...GOAL_JUDGE_REQUEST_PARAMS },
        parentConversationId: opts?.parentConversationId,
      }),
    );
    if (recorded.status === "error" || !recorded.completion) {
      return { ok: false, error: recorded.error ?? "judge LLM call failed" };
    }
    const resp = recorded.completion;
    const content = resp.content ?? "";
    const parsed = parseGoalJudgeOutput(content);
    if (parsed.ok) return parsed;
    const hadReasoning = Boolean((resp.reasoning ?? "").trim());
    // 推理模型 content 空、reasoning 有内容：多半是 max_tokens 被 thinking 占满
    if (!content.trim() && hadReasoning) {
      return {
        ok: false,
        error: `${parsed.error} (empty content, reasoning present; likely maxOutputTokens exhausted by thinking)`,
      };
    }
    return parsed;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** @internal exported for tests */
export const goalJudgeJsonFields = GOAL_JUDGE_JSON_SCHEMA;
