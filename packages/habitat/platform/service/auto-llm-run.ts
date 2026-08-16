import * as loopEngine from "@freeanima/habitat/kernel/loop-mechanism";
import { isTransientNetworkError } from "@freeanima/habitat/kernel/loop-mechanism";
import { runWithToolContext, toolCallTitleFromArgs } from "@freeanima/habitat/core/tool";
import type { ConversationGoal, StoredMessage } from "@freeanima/habitat/core/db/domain";
import { conversationGoalSchema } from "@freeanima/habitat/core/db/domain";
import type { MessagePayload } from "@freeanima/habitat/core/db/schema";
import { formatCstIso, omitUndefined } from "@freeanima/habitat/core/util";
import { generateAutoLlmRunId, judgeGoal } from "@freeanima/habitat/core/llm";
import {
  AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS,
  AUTO_LLM_DEFAULT_MAX_DURATION_MS,
} from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { getProfileHopModel } from "@freeanima/habitat/core/config";
import { PROFILE_CHAT, PROFILE_GOAL_JUDGE } from "@freeanima/habitat/core/provider";
import type { LlmCallParams } from "@freeanima/habitat/core/provider";
import {
  formatGoalContinuePrompt,
  formatGoalExhaustedMessage,
} from "@freeanima/habitat/engine/goal";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { appendAutoLlmRun } from "@freeanima/habitat/core/db/pg/auto-llm-run";

import type { FullRuntimeDeps } from "./runtime-deps.ts";
import type { ResolvedCapabilityPolicy } from "@freeanima/habitat/core/capability-policy";
import { runtimeToolPolicyFromResolved } from "./capability-policy-bind.ts";

export { AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS, AUTO_LLM_DEFAULT_MAX_DURATION_MS };

const AUTO_LLM_MAX_ATTEMPTS = 3;
const AUTO_LLM_RETRY_BASE_MS = 500;
const OUTPUT_MAX = 10_000;

/** UI 用紧凑步骤（不含完整 args/result） */
export type AutoLlmToolStep = {
  name: string;
  title?: string;
  status: "running" | "done" | "error";
};

export type AutoLlmRunInput = {
  runName: string;
  runKind: string;
  /** Acting subject for tool world grants (required; multi-anima ready) */
  subjectId: number;
  systemPrompt: string;
  userMessages: string[];
  model?: string;
  toolNames: string[];
  maxLoopIterations: number;
  /** 墙钟上限 ms；省略则不限 */
  maxDurationMs?: number;
  goal?: ConversationGoal;
  metadata?: Record<string, unknown>;
  toolPolicy?: ResolvedCapabilityPolicy;
  /** Per-call sampling (e.g. subagent temperature_tier → params) */
  requestParams?: Partial<LlmCallParams>;
  onToolResult?: (name: string, content: string) => void;
  /** 子工具 steps 变更（含 running）；供父 Chat 进度投影 */
  onStep?: (steps: readonly AutoLlmToolStep[]) => void;
  parentConversationId?: string;
};

export type AutoLlmRunResult = {
  runId: string;
  output: string;
  toolCalls: number;
  status: "ok" | "error";
  error?: string;
  durationMs: number;
  steps: AutoLlmToolStep[];
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
  parentConversationId?: string,
): Promise<
  | { action: "stop"; goal: ConversationGoal }
  | { action: "continue"; goal: ConversationGoal; continuePrompt: string }
> {
  if (goal.status === "paused" || goal.status === "completed" || goal.status === "exhausted") {
    return { action: "stop", goal };
  }
  if (goal.continue_count >= goal.max_continues) {
    return {
      action: "stop",
      goal: conversationGoalSchema.parse({
        ...goal,
        status: "exhausted",
        last_judge_reason: formatGoalExhaustedMessage(goal.max_continues),
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
    omitUndefined({
      runtime: deps.engine.llm,
      model,
      parentConversationId,
    }),
  );

  if (!judge.ok) {
    deps.engine.logger
      .with({ component: "goal" })
      .warn("goal judge failed; pausing auto-continue", {
        error: judge.error,
        continue_count: goal.continue_count,
        max_continues: goal.max_continues,
        model,
      });
    return {
      action: "stop",
      goal: conversationGoalSchema.parse({
        ...goal,
        status: "paused",
        last_judge_reason: judge.error,
      }),
    };
  }

  if (judge.done) {
    return {
      action: "stop",
      goal: conversationGoalSchema.parse({
        ...goal,
        status: "completed",
        last_judge_reason: judge.reason,
        completed_at: formatCstIso(),
      }),
    };
  }

  const nextCount = goal.continue_count + 1;
  const updated = conversationGoalSchema.parse({
    ...goal,
    continue_count: nextCount,
    last_judge_reason: judge.reason,
  });
  if (nextCount >= goal.max_continues) {
    return {
      action: "stop",
      goal: conversationGoalSchema.parse({ ...updated, status: "exhausted" }),
    };
  }

  return {
    action: "continue",
    goal: updated,
    continuePrompt: formatGoalContinuePrompt(nextCount, goal.max_continues, judge.reason),
  };
}

async function runEngineOnce(
  deps: FullRuntimeDeps,
  runId: string,
  input: AutoLlmRunInput,
  messages: StoredMessage[],
  model: string,
  signal?: AbortSignal,
): Promise<{ output: string; toolCalls: number; steps: AutoLlmToolStep[] }> {
  const tools = deps.engine.catalog.toolSets.openaiSchemasFromNames(input.toolNames);
  const toolPolicy = runtimeToolPolicyFromResolved(input.toolPolicy ?? null);
  let toolCalls = 0;
  const parts: string[] = [];
  const steps: AutoLlmToolStep[] = [];

  await runWithToolContext(
    runId,
    async () => {
      for await (const ev of loopEngine.runStream(messages, {
        model,
        tools,
        logger: deps.engine.logger,
        llm: deps.engine.llm,
        executableTools: input.toolNames,
        conversationId: "",
        ...omitUndefined({ toolPolicy, requestParams: input.requestParams, signal }),
        max_loop_iterations: input.maxLoopIterations,
        hookRegistry: deps.kernel.hookRegistry,
        llm_kind: "auto_llm",
      })) {
        switch (ev.event) {
          case "token":
            parts.push(ev.data.content);
            break;
          case "content_replace":
            parts.length = 0;
            parts.push(ev.data.content);
            break;
          case "tool_begin": {
            toolCalls += 1;
            const title = toolCallTitleFromArgs(ev.data.args);
            steps.push(
              omitUndefined({
                name: ev.data.name,
                title,
                status: "running" as const,
              }),
            );
            input.onStep?.(steps.map((s) => ({ ...s })));
            break;
          }
          case "tool_result": {
            input.onToolResult?.(ev.data.name, ev.data.content);
            const isError =
              ev.data.content.includes('"error"') ||
              ev.data.content.startsWith('{"error"') ||
              ev.data.content.startsWith("Error:");
            const pending = steps.findLast(
              (s) => s.name === ev.data.name && s.status === "running",
            );
            if (pending) pending.status = isError ? "error" : "done";
            input.onStep?.(steps.map((s) => ({ ...s })));
            break;
          }
          case "error":
            throw new Error(ev.data.error);
          default:
            break;
        }
      }
    },
    {
      tools: deps.engine.catalog.toolSets,
      contextKind: "auto_llm",
      executableTools: input.toolNames,
      subjectId: input.subjectId,
      ...omitUndefined({ parentConversationId: input.parentConversationId }),
    },
  );

  for (const step of steps) {
    if (step.status === "running") step.status = "done";
  }

  const output = parts.join("").trim() || `Completed ${toolCalls} tool call(s)`;
  return { output, toolCalls, steps };
}

function storedMessagesToPayloads(messages: StoredMessage[]): MessagePayload[] {
  const payloads: MessagePayload[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      payloads.push({
        role: "system",
        content: typeof msg.content === "string" ? msg.content : "",
        ...omitUndefined({ timestamp: msg.timestamp, name: msg.name }),
      });
      continue;
    }
    if (msg.role === "user") {
      payloads.push({
        role: "user",
        content: msg.content,
        ...omitUndefined({ timestamp: msg.timestamp, name: msg.name }),
      });
      continue;
    }
    if (msg.role === "assistant") {
      payloads.push({
        role: "assistant",
        content: msg.content ?? null,
        ...omitUndefined({
          timestamp: msg.timestamp,
          name: msg.name,
          tool_calls: msg.tool_calls,
          model: msg.model,
          finish_reason: msg.finish_reason,
          reasoning: msg.reasoning,
        }),
      });
      continue;
    }
    if (msg.role === "tool") {
      payloads.push({
        role: "tool",
        tool_call_id: msg.tool_call_id,
        content: msg.content,
        ...omitUndefined({ timestamp: msg.timestamp, name: msg.name }),
      });
    }
  }
  return payloads;
}

async function persistAutoLlmRun(
  _deps: FullRuntimeDeps,
  row: {
    id: string;
    input: AutoLlmRunInput;
    output: string;
    status: "ok" | "error";
    durationMs: number;
    error?: string;
    toolCalls: number;
    startedAt: string;
    finishedAt: string;
    messages: StoredMessage[];
  },
): Promise<void> {
  if (!isPostgresPrimary()) return;
  const payloads = storedMessagesToPayloads(row.messages);
  await appendAutoLlmRun({
    id: row.id,
    run_name: row.input.runName,
    run_kind: row.input.runKind,
    subject_id: row.input.subjectId,
    output: row.output.slice(0, OUTPUT_MAX),
    status: row.status,
    duration_ms: row.durationMs,
    max_loop_iterations: row.input.maxLoopIterations,
    max_duration_ms: row.input.maxDurationMs ?? null,
    error: row.error ?? null,
    metadata: {
      ...row.input.metadata,
      model: row.input.model,
      tool_calls: row.toolCalls,
      parent_conversation_id: row.input.parentConversationId,
    },
    created_at: row.startedAt,
    finished_at: row.finishedAt,
    messages: payloads.map((payload, pos) => ({ pos, payload })),
  });
}

function withWallClockSignal<T>(
  maxDurationMs: number | undefined,
  run: (signal?: AbortSignal) => Promise<T>,
): Promise<T> {
  if (maxDurationMs == null || maxDurationMs <= 0) {
    return run(undefined);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => {
    ac.abort(new Error(`AutoLlm wall-clock timeout after ${maxDurationMs}ms`));
  }, maxDurationMs);
  return run(ac.signal).finally(() => {
    clearTimeout(timer);
  });
}

/** 无用户回合 LLM：不写 conversations/messages，过程写入 auto_llm_runs + auto_llm_messages */
export async function runAutoLlm(
  deps: FullRuntimeDeps,
  input: AutoLlmRunInput,
): Promise<AutoLlmRunResult> {
  const runId = generateAutoLlmRunId();
  const startedAt = formatCstIso();
  const startMs = Date.now();
  const model = input.model ?? getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);

  let messages = buildAutoLlmMessages(input);
  let goal = input.goal ? conversationGoalSchema.parse(input.goal) : undefined;
  let output = "";
  let toolCalls = 0;
  let steps: AutoLlmToolStep[] = [];
  let lastErr: unknown;

  try {
    for (let attempt = 0; attempt < AUTO_LLM_MAX_ATTEMPTS; attempt++) {
      output = "";
      toolCalls = 0;
      steps = [];
      try {
        await withWallClockSignal(input.maxDurationMs, async (signal) => {
          goalLoop: while (true) {
            if (signal?.aborted) {
              const reason =
                signal.reason instanceof Error
                  ? signal.reason.message
                  : `AutoLlm wall-clock timeout after ${input.maxDurationMs}ms`;
              throw new Error(reason);
            }
            const round = await runEngineOnce(deps, runId, input, messages, model, signal);
            output = round.output;
            toolCalls += round.toolCalls;
            steps = [...steps, ...round.steps];

            if (!goal) break goalLoop;
            const evalResult = await evaluateGoalForAutoLlm(
              deps,
              goal,
              messages,
              input.parentConversationId,
            );
            goal = evalResult.goal;
            if (evalResult.action !== "continue") break goalLoop;
            messages = [
              ...messages,
              { role: "user", content: evalResult.continuePrompt, timestamp: formatCstIso() },
            ];
          }
        });
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
      output,
      status: "ok",
      durationMs,
      toolCalls,
      startedAt,
      finishedAt,
      messages,
    });
    return { runId, output, toolCalls, status: "ok", durationMs, steps };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const finishedAt = formatCstIso();
    const message = err instanceof Error ? err.message : String(err);
    await persistAutoLlmRun(deps, {
      id: runId,
      input,
      output: output || message,
      status: "error",
      durationMs,
      error: message,
      toolCalls,
      startedAt,
      finishedAt,
      messages,
    });
    return {
      runId,
      output: output || message,
      toolCalls,
      status: "error",
      error: message,
      durationMs,
      steps,
    };
  }
}
