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
import {
  appendAutoLlmMessages,
  finishAutoLlmRun,
  insertRunningAutoLlmRun,
} from "@freeanima/habitat/core/db/pg/auto-llm-run";

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
  signal: AbortSignal | undefined,
  onMessagesPersisted: (batch: StoredMessage[]) => Promise<void>,
): Promise<{ toolCalls: number; steps: AutoLlmToolStep[] }> {
  const tools = deps.engine.catalog.toolSets.openaiSchemasFromNames(input.toolNames);
  const toolPolicy = runtimeToolPolicyFromResolved(input.toolPolicy ?? null);
  let toolCalls = 0;
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
        onToolRoundComplete: onMessagesPersisted,
      })) {
        switch (ev.event) {
          case "token":
          case "content_replace":
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

  return { toolCalls, steps };
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

/** 最后一条成功助手正文：有 content、无 tool_calls */
export function lastSuccessfulAssistantText(messages: StoredMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "assistant") continue;
    if (m.tool_calls && m.tool_calls.length > 0) continue;
    const content = typeof m.content === "string" ? m.content.trim() : "";
    if (content) return content.slice(0, OUTPUT_MAX);
  }
  return "";
}

function buildAutoLlmMetadata(input: AutoLlmRunInput, model: string): Record<string, unknown> {
  return omitUndefined({
    ...input.metadata,
    model,
    tool_names: input.toolNames,
    request_params: input.requestParams,
    parent_conversation_id: input.parentConversationId,
  });
}

type AutoLlmAudit = {
  nextPos: number;
};

function warnAutoLlmPersist(deps: FullRuntimeDeps, err: unknown): void {
  deps.engine.logger.with({ component: "auto-llm" }).warn("auto_llm persist failed", {
    error: err instanceof Error ? err.message : String(err),
  });
}

async function persistRunningStart(
  deps: FullRuntimeDeps,
  audit: AutoLlmAudit,
  row: {
    id: string;
    input: AutoLlmRunInput;
    model: string;
    startedAt: string;
    messages: StoredMessage[];
  },
): Promise<void> {
  if (!isPostgresPrimary()) return;
  try {
    const payloads = storedMessagesToPayloads(row.messages);
    await insertRunningAutoLlmRun({
      id: row.id,
      run_name: row.input.runName,
      run_kind: row.input.runKind,
      subject_id: row.input.subjectId,
      max_loop_iterations: row.input.maxLoopIterations,
      max_duration_ms: row.input.maxDurationMs ?? null,
      metadata: buildAutoLlmMetadata(row.input, row.model),
      created_at: row.startedAt,
      messages: payloads.map((payload, pos) => ({ pos, payload })),
    });
    audit.nextPos = payloads.length;
  } catch (err) {
    warnAutoLlmPersist(deps, err);
  }
}

async function persistMessageBatch(
  deps: FullRuntimeDeps,
  audit: AutoLlmAudit,
  runId: string,
  batch: StoredMessage[],
): Promise<void> {
  if (!isPostgresPrimary() || batch.length === 0) return;
  try {
    const payloads = storedMessagesToPayloads(batch);
    if (payloads.length === 0) return;
    const msgs = payloads.map((payload) => {
      const pos = audit.nextPos;
      audit.nextPos += 1;
      return { pos, payload };
    });
    await appendAutoLlmMessages(runId, msgs);
  } catch (err) {
    warnAutoLlmPersist(deps, err);
  }
}

async function persistRunFinish(
  deps: FullRuntimeDeps,
  row: {
    id: string;
    output: string;
    status: "ok" | "error";
    durationMs: number;
    error?: string;
    finishedAt: string;
  },
): Promise<void> {
  if (!isPostgresPrimary()) return;
  try {
    await finishAutoLlmRun({
      id: row.id,
      status: row.status,
      output: row.output,
      duration_ms: row.durationMs,
      finished_at: row.finishedAt,
      ...omitUndefined({ error: row.error }),
    });
  } catch (err) {
    warnAutoLlmPersist(deps, err);
  }
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

/** 无用户回合 LLM：不写 conversations/messages；过程写入 auto_llm_runs + auto_llm_messages */
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
  let toolCalls = 0;
  let steps: AutoLlmToolStep[] = [];
  let lastErr: unknown;
  const audit: AutoLlmAudit = { nextPos: 0 };

  await persistRunningStart(deps, audit, {
    id: runId,
    input,
    model,
    startedAt,
    messages,
  });

  const persistBatch = (batch: StoredMessage[]): Promise<void> =>
    persistMessageBatch(deps, audit, runId, batch);

  try {
    for (let attempt = 0; attempt < AUTO_LLM_MAX_ATTEMPTS; attempt++) {
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
            const round = await runEngineOnce(
              deps,
              runId,
              input,
              messages,
              model,
              signal,
              persistBatch,
            );
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
            const continueMsg: StoredMessage = {
              role: "user",
              content: evalResult.continuePrompt,
              timestamp: formatCstIso(),
            };
            messages = [...messages, continueMsg];
            await persistBatch([continueMsg]);
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
    const output = lastSuccessfulAssistantText(messages);
    await persistRunFinish(deps, {
      id: runId,
      output,
      status: "ok",
      durationMs,
      finishedAt,
    });
    return { runId, output, toolCalls, status: "ok", durationMs, steps };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const finishedAt = formatCstIso();
    const message = err instanceof Error ? err.message : String(err);
    const output = lastSuccessfulAssistantText(messages);
    await persistRunFinish(deps, {
      id: runId,
      output,
      status: "error",
      durationMs,
      error: message,
      finishedAt,
    });
    return {
      runId,
      output,
      toolCalls,
      status: "error",
      error: message,
      durationMs,
      steps,
    };
  }
}
