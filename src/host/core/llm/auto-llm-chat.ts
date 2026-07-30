import { randomBytes } from "node:crypto";
import { omitUndefined, CST_OFFSET_MS, formatCstIso } from "@freeanima/host/core/util";
import type { MessagePayload } from "@freeanima/host/core/db/schema";
import type { LlmCallParams } from "@freeanima/host/core/provider";
import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import { appendAutoLlmRun } from "@freeanima/host/core/db/pg/auto-llm-run";
import { chat, type LlmResponse } from "./llm.ts";
import type { LlmRuntime } from "./llm-stack.ts";
import type { SimpleChatMessage } from "./llm-adapt.ts";

const OUTPUT_MAX = 10_000;
const INPUT_SUMMARY_MAX = 2000;

export type AutoLlmChatMessage = SimpleChatMessage;

export type AutoLlmChatInput = {
  runName: string;
  runKind: string;
  messages: AutoLlmChatMessage[];
  profileId?: string;
  model?: string;
  requestParams?: Partial<LlmCallParams>;
  metadata?: Record<string, unknown>;
  parentConversationId?: string;
  runtime?: LlmRuntime;
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

function summarizeChatInput(messages: AutoLlmChatMessage[]): string {
  const parts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean);
  return parts.join("\n---\n").slice(0, INPUT_SUMMARY_MAX);
}

function toPayloads(messages: AutoLlmChatMessage[], assistantContent: string): MessagePayload[] {
  const now = formatCstIso();
  const payloads: MessagePayload[] = messages.map((m) => {
    if (m.role === "system") {
      return { role: "system", content: m.content, timestamp: now };
    }
    if (m.role === "assistant") {
      return { role: "assistant", content: m.content, timestamp: now };
    }
    return { role: "user", content: m.content, timestamp: now };
  });
  payloads.push({ role: "assistant", content: assistantContent, timestamp: now });
  return payloads;
}

async function persistChatRun(row: {
  id: string;
  input: AutoLlmChatInput;
  inputSummary: string;
  output: string;
  status: "ok" | "error";
  durationMs: number;
  error?: string;
  startedAt: string;
  finishedAt: string;
  messagePayloads: MessagePayload[];
}): Promise<void> {
  if (!isPostgresPrimary()) return;
  await appendAutoLlmRun({
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
      parent_conversation_id: row.input.parentConversationId,
      profile_id: row.input.profileId,
    },
    created_at: row.startedAt,
    finished_at: row.finishedAt,
    messages: row.messagePayloads.map((payload, pos) => ({ pos, payload })),
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
  const inputSummary = summarizeChatInput(input.messages);

  try {
    const completion = await chat(
      input.messages,
      omitUndefined({
        profileId: input.profileId,
        runtime: input.runtime,
        model: input.model,
        requestParams: input.requestParams,
      }),
    );
    const output = String(completion.content ?? "").trim();
    const durationMs = Date.now() - startMs;
    const finishedAt = formatCstIso();
    await persistChatRun({
      id: runId,
      input,
      inputSummary,
      output: output || "(empty)",
      status: "ok",
      durationMs,
      startedAt,
      finishedAt,
      messagePayloads: toPayloads(input.messages, output || "(empty)"),
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
    await persistChatRun({
      id: runId,
      input,
      inputSummary,
      output: message,
      status: "error",
      durationMs,
      error: message,
      startedAt,
      finishedAt,
      messagePayloads: toPayloads(input.messages, message),
    });
    return {
      runId,
      output: message,
      status: "error",
      error: message,
      durationMs,
    };
  }
}
