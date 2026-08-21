import { randomBytes } from "node:crypto";
import { omitUndefined, CST_OFFSET_MS, formatCstIso } from "@freeanima/habitat/core/util";
import type { MessagePayload } from "@freeanima/habitat/core/db/schema";
import { normalizeUsage, type LlmCallParams } from "@freeanima/habitat/core/provider";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import {
  appendAutoLlmMessages,
  finishAutoLlmRun,
  insertRunningAutoLlmRun,
} from "@freeanima/habitat/core/db/pg/auto-llm-run";
import { chat, type LlmResponse } from "./llm.ts";
import type { LlmRuntime } from "./llm-stack.ts";
import type { SimpleChatMessage } from "./llm-adapt.ts";

const OUTPUT_MAX = 10_000;

export type AutoLlmChatMessage = SimpleChatMessage;

export type AutoLlmChatInput = {
  runName: string;
  runKind: string;
  /** 行动主体；无工具侧车（title / 压缩等）通常省略 */
  subjectId?: number;
  messages: AutoLlmChatMessage[];
  profileId?: string;
  model?: string;
  requestParams?: Partial<LlmCallParams>;
  metadata?: Record<string, unknown>;
  parentConversationId?: string;
  runtime?: LlmRuntime;
  /** chat 无工具环；落库审计用，默认 1 */
  maxLoopIterations?: number;
  /** 墙钟上限 ms；省略则不限 */
  maxDurationMs?: number;
};

export type AutoLlmChatResult = {
  runId: string;
  output: string;
  status: "ok" | "error";
  error?: string;
  durationMs: number;
  completion?: LlmResponse;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function generateAutoLlmRunId(): string {
  const d = new Date(Date.now() + CST_OFFSET_MS);
  const ts = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}_${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`;
  return `autollm_${ts}_${randomBytes(2).toString("hex")}`;
}

function toInputPayloads(messages: AutoLlmChatMessage[]): MessagePayload[] {
  const now = formatCstIso();
  return messages.map((m) => {
    if (m.role === "system") {
      return { role: "system", content: m.content, timestamp: now };
    }
    if (m.role === "assistant") {
      return { role: "assistant", content: m.content, timestamp: now };
    }
    return { role: "user", content: m.content, timestamp: now };
  });
}

function assistantPayload(
  content: string,
  completion?: LlmResponse,
  latencyMs?: number,
): MessagePayload {
  const usage = completion?.usage ? normalizeUsage(completion.usage) : null;
  return {
    role: "assistant",
    content,
    timestamp: formatCstIso(),
    ...omitUndefined({
      usage: usage ?? undefined,
      latency_ms: latencyMs,
      model: completion?.model,
    }),
  };
}

function buildChatMetadata(input: AutoLlmChatInput): Record<string, unknown> {
  return omitUndefined({
    ...input.metadata,
    model: input.model,
    request_params: input.requestParams,
    parent_conversation_id: input.parentConversationId,
    profile_id: input.profileId,
  });
}

async function persistChatStart(row: {
  id: string;
  input: AutoLlmChatInput;
  startedAt: string;
  inputPayloads: MessagePayload[];
}): Promise<void> {
  try {
    if (!isPostgresPrimary()) return;
    await insertRunningAutoLlmRun({
      id: row.id,
      run_name: row.input.runName,
      run_kind: row.input.runKind,
      subject_id: row.input.subjectId ?? null,
      max_loop_iterations: row.input.maxLoopIterations ?? 1,
      max_duration_ms: row.input.maxDurationMs ?? null,
      metadata: buildChatMetadata(row.input),
      created_at: row.startedAt,
      messages: row.inputPayloads.map((payload, pos) => ({
        pos,
        payload,
        subject_id: row.input.subjectId ?? null,
      })),
    });
  } catch {
    // 落库失败不得掩盖 chat 结果
  }
}

async function persistChatAssistant(
  runId: string,
  subjectId: number | null | undefined,
  pos: number,
  content: string,
  completion: LlmResponse,
  latencyMs: number,
): Promise<void> {
  try {
    if (!isPostgresPrimary()) return;
    await appendAutoLlmMessages(runId, [
      {
        pos,
        payload: assistantPayload(content, completion, latencyMs),
        subject_id: subjectId ?? null,
      },
    ]);
  } catch {
    // ignore
  }
}

async function persistChatFinish(row: {
  id: string;
  output: string;
  status: "ok" | "error";
  durationMs: number;
  error?: string;
  finishedAt: string;
}): Promise<void> {
  try {
    if (!isPostgresPrimary()) return;
    await finishAutoLlmRun({
      id: row.id,
      status: row.status,
      output: row.output.slice(0, OUTPUT_MAX),
      duration_ms: row.durationMs,
      finished_at: row.finishedAt,
      ...omitUndefined({ error: row.error }),
    });
  } catch {
    // ignore
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
  const timeoutPromise = new Promise<never>((_, reject) => {
    ac.signal.addEventListener(
      "abort",
      () => {
        const reason =
          ac.signal.reason instanceof Error
            ? ac.signal.reason
            : new Error(`AutoLlm wall-clock timeout after ${maxDurationMs}ms`);
        reject(reason);
      },
      { once: true },
    );
  });
  return Promise.race([run(ac.signal), timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * 一次性 chat completion → 写入 auto_llm_runs + auto_llm_messages。
 * 侧车 LLM（title / goal_judge / compression）须经此出口，禁止业务直调 chat()。
 */
export async function runAutoLlmChat(input: AutoLlmChatInput): Promise<AutoLlmChatResult> {
  const runId = generateAutoLlmRunId();
  const startedAt = formatCstIso();
  const startMs = Date.now();
  const inputPayloads = toInputPayloads(input.messages);
  await persistChatStart({ id: runId, input, startedAt, inputPayloads });

  try {
    const completion = await withWallClockSignal(input.maxDurationMs, async (signal) => {
      if (signal?.aborted) {
        const reason =
          signal.reason instanceof Error
            ? signal.reason.message
            : `AutoLlm wall-clock timeout after ${input.maxDurationMs}ms`;
        throw new Error(reason);
      }
      return chat(
        input.messages,
        omitUndefined({
          profileId: input.profileId,
          runtime: input.runtime,
          model: input.model,
          requestParams: input.requestParams,
          signal,
        }),
      );
    });
    const output = (completion.content ?? "").trim();
    const durationMs = Date.now() - startMs;
    const finishedAt = formatCstIso();
    if (output) {
      const latencyMs =
        typeof completion.latency_ms === "number" && Number.isFinite(completion.latency_ms)
          ? completion.latency_ms
          : durationMs;
      await persistChatAssistant(
        runId,
        input.subjectId,
        inputPayloads.length,
        output,
        completion,
        latencyMs,
      );
    }
    await persistChatFinish({
      id: runId,
      output,
      status: "ok",
      durationMs,
      finishedAt,
    });
    return omitUndefined({
      runId,
      output,
      status: "ok" as const,
      durationMs,
      completion,
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const finishedAt = formatCstIso();
    const message = err instanceof Error ? err.message : String(err);
    await persistChatFinish({
      id: runId,
      output: "",
      status: "error",
      durationMs,
      error: message,
      finishedAt,
    });
    return {
      runId,
      output: "",
      status: "error",
      error: message,
      durationMs,
    };
  }
}
