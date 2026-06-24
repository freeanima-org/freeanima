import { randomBytes } from "node:crypto";
import * as loopEngine from "@freeanima/runtime/loop";
import { isTransientNetworkError } from "@freeanima/runtime/loop";
import { runWithToolContext } from "@freeanima/core/tool";
import type { ConversationGoal, StoredMessage } from "@freeanima/core/db/domain";
import { conversationGoalSchema } from "@freeanima/core/db/domain";
import { CST_OFFSET_MS, formatCstIso } from "@freeanima/core/util";
import { judgeGoal } from "@freeanima/core/llm/goal-judge";
import { getProfileHopModel } from "@freeanima/core/config";
import { PROFILE_CHAT, PROFILE_GOAL_JUDGE } from "@freeanima/core/provider";
import { formatGoalContinuePrompt, formatGoalExhaustedMessage } from "@freeanima/runtime/goal";

import type { FullRuntimeDeps } from "./runtime-deps.ts";
import type { ResolvedMask } from "@freeanima/capabilities-tasks/mask";
import { runtimeToolMaskFromResolved } from "./mask-wire.ts";

const AUTO_LLM_MAX_ATTEMPTS = 3;
const AUTO_LLM_RETRY_BASE_MS = 500;
const OUTPUT_MAX = 10_000;
const INPUT_SUMMARY_MAX = 2000;

export type AutoLlmRunInput = {
  runName: string;
  runKind: string;
  systemPrompt: string;
  userMessages: string[];
  model?: string;
  toolNames: string[];
  maxTurns: number;
  goal?: ConversationGoal;
  metadata?: Record<string, unknown>;
  toolMask?: ResolvedMask;
  onToolResult?: (name: string, content: string) => void;
  parentConversationId?: string;
};

export type AutoLlmRunResult = {
  runId: string;
  output: string;
  toolCalls: number;
  status: "ok" | "error";
  error?: string;
  durationMs: number;
};

export function generateAutoLlmRunId(): string {
  const d = new Date(Date.now() + CST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `autollm_${ts}_${randomBytes(2).toString("hex")}`;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAutoLlmRetryable(err: unknown): boolean {
  if (isTransientNetworkError(err)) return true;
  if (err instanceof Error) {
    return /LLM call failed/i.test(err.message) && isTransientNetworkError(err.cause ?? err);
  }
  return false;
}

function buildAutoLlmMessages(input: AutoLlmRunInput): StoredMessage[] {
  const now = formatCstIso();
  const messages: StoredMessage[] = [{ role: "system", content: input.systemPrompt }];
  for (const content of input.userMessages) {
    messages.push({ role: "user", content, timestamp: now });
  }
  return messages;
}

function summarizeInput(input: AutoLlmRunInput): string {
  const parts = input.userMessages.map((m) => m.trim()).filter(Boolean);
  const joined = parts.join("\n---\n");
  return joined.slice(0, INPUT_SUMMARY_MAX);
}

function lastAssistantText(msgs: StoredMessage[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "assistant") {
      const content = m.content;
      return typeof content === "string" ? content : "";
    }
  }
  return "";
}

function buildRecentContext(msgs: StoredMessage[], limit = 4): string {
  const lines: string[] = [];
  for (const msg of msgs.slice(-limit)) {
    if (msg.role === "user" || msg.role === "assistant") {
      const content = typeof msg.content === "string" ? msg.content : "";
      if (content.trim()) lines.push(`${msg.role}: ${content.trim().slice(0, 500)}`);
    }
  }
  return lines.join("\n");
}

async function evaluateGoalForAutoLlm(
  deps: FullRuntimeDeps,
  goal: ConversationGoal,
  msgs: StoredMessage[],
): Promise<
  | { action: "stop"; goal: ConversationGoal }
  | { action: "continue"; goal: ConversationGoal; continuePrompt: string }
> {
  if (goal.status === "paused" || goal.status === "completed" || goal.status === "exhausted") {
    return { action: "stop", goal };
  }
  if (goal.turn_count >= goal.max_turns) {
    return {
      action: "stop",
      goal: conversationGoalSchema.parse({
        ...goal,
        status: "exhausted",
        last_judge_reason: formatGoalExhaustedMessage(goal.max_turns),
      }),
    };
  }

  const model = getProfileHopModel(deps.engine.config.data, PROFILE_GOAL_JUDGE);
  const judge = await judgeGoal(
    {
      goal: goal.description,
      subgoals: goal.subgoals,
      assistantReply: lastAssistantText(msgs),
      recentContext: buildRecentContext(msgs),
    },
    { runtime: deps.engine.llm, model },
  );

  const reason = judge.ok ? judge.reason : judge.error;
  if (judge.ok && judge.done) {
    return {
      action: "stop",
      goal: conversationGoalSchema.parse({
        ...goal,
        status: "completed",
        last_judge_reason: reason,
        completed_at: formatCstIso(),
      }),
    };
  }

  const nextCount = goal.turn_count + 1;
  const updated = conversationGoalSchema.parse({
    ...goal,
    turn_count: nextCount,
    last_judge_reason: reason,
  });
  if (nextCount >= goal.max_turns) {
    return {
      action: "stop",
      goal: conversationGoalSchema.parse({ ...updated, status: "exhausted" }),
    };
  }

  return {
    action: "continue",
    goal: updated,
    continuePrompt: formatGoalContinuePrompt(nextCount, goal.max_turns, reason),
  };
}

async function runEngineOnce(
  deps: FullRuntimeDeps,
  runId: string,
  input: AutoLlmRunInput,
  messages: StoredMessage[],
  model: string,
): Promise<{ output: string; toolCalls: number }> {
  const tools = deps.engine.catalog.toolSets.openaiSchemasFromNames(input.toolNames);
  const toolMask = runtimeToolMaskFromResolved(input.toolMask ?? null);
  let toolCalls = 0;
  const parts: string[] = [];

  await runWithToolContext(
    runId,
    async () => {
      for await (const ev of loopEngine.runStream(messages, {
        model,
        tools,
        config: deps.engine.config.data,
        logger: deps.engine.logger,
        llm: deps.engine.llm,
        toolMask,
        max_turns: input.maxTurns,
      })) {
        switch (ev.event) {
          case "token":
            parts.push(ev.data.content);
            break;
          case "content_replace":
            parts.length = 0;
            parts.push(ev.data.content);
            break;
          case "tool_begin":
            toolCalls += 1;
            break;
          case "tool_result":
            input.onToolResult?.(ev.data.name, ev.data.content);
            break;
          case "error":
            throw new Error(ev.data.error);
          default:
            break;
        }
      }
    },
    {
      repos: deps.conversation.repos,
      tools: deps.engine.catalog.toolSets,
      contextKind: "auto_llm",
      parentConversationId: input.parentConversationId,
    },
  );

  const output = parts.join("").trim() || `Completed ${toolCalls} tool call(s)`;
  return { output, toolCalls };
}

async function persistAutoLlmRun(
  deps: FullRuntimeDeps,
  row: {
    id: string;
    input: AutoLlmRunInput;
    inputSummary: string;
    output: string;
    status: "ok" | "error";
    durationMs: number;
    error?: string;
    toolCalls: number;
    startedAt: string;
    finishedAt: string;
  },
): Promise<void> {
  if (!deps.conversation.repos.pgAvailable) return;
  await deps.conversation.repos.autoLlmRun.append({
    id: row.id,
    run_name: row.input.runName,
    run_kind: row.input.runKind,
    input_summary: row.inputSummary,
    output: row.output.slice(0, OUTPUT_MAX),
    status: row.status,
    duration_ms: row.durationMs,
    error: row.error ?? null,
    metadata: {
      ...row.input.metadata,
      model: row.input.model,
      tool_calls: row.toolCalls,
      parent_conversation_id: row.input.parentConversationId,
    },
    created_at: row.startedAt,
    finished_at: row.finishedAt,
  });
}

/** 无用户 LLM 执行：不写 session/messages，过程写入 auto_llm_runs */
export async function runAutoLlm(
  deps: FullRuntimeDeps,
  input: AutoLlmRunInput,
): Promise<AutoLlmRunResult> {
  const runId = generateAutoLlmRunId();
  const startedAt = formatCstIso();
  const startMs = Date.now();
  const model = input.model ?? getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);

  const inputSummary = summarizeInput(input);
  let messages = buildAutoLlmMessages(input);
  let goal = input.goal ? conversationGoalSchema.parse(input.goal) : undefined;
  let output = "";
  let toolCalls = 0;
  let lastErr: unknown;

  try {
    for (let attempt = 0; attempt < AUTO_LLM_MAX_ATTEMPTS; attempt++) {
      output = "";
      toolCalls = 0;
      try {
        goalLoop: while (true) {
          const round = await runEngineOnce(deps, runId, input, messages, model);
          output = round.output;
          toolCalls += round.toolCalls;

          if (!goal) break goalLoop;
          const evalResult = await evaluateGoalForAutoLlm(deps, goal, messages);
          goal = evalResult.goal;
          if (evalResult.action !== "continue") break goalLoop;
          messages = [
            ...messages,
            { role: "user", content: evalResult.continuePrompt, timestamp: formatCstIso() },
          ];
        }
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        if (!isAutoLlmRetryable(err) || attempt >= AUTO_LLM_MAX_ATTEMPTS - 1) throw err;
        await sleepMs(AUTO_LLM_RETRY_BASE_MS * (attempt + 1));
      }
    }
    if (lastErr) throw lastErr;

    const durationMs = Date.now() - startMs;
    const finishedAt = formatCstIso();
    await persistAutoLlmRun(deps, {
      id: runId,
      input,
      inputSummary,
      output,
      status: "ok",
      durationMs,
      toolCalls,
      startedAt,
      finishedAt,
    });
    return { runId, output, toolCalls, status: "ok", durationMs };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const finishedAt = formatCstIso();
    const message = err instanceof Error ? err.message : String(err);
    await persistAutoLlmRun(deps, {
      id: runId,
      input,
      inputSummary,
      output: output || message,
      status: "error",
      durationMs,
      error: message,
      toolCalls,
      startedAt,
      finishedAt,
    });
    return {
      runId,
      output: output || message,
      toolCalls,
      status: "error",
      error: message,
      durationMs,
    };
  }
}
