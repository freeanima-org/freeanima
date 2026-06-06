import {
  parseToolArgs,
  toolError,
  toolResult,
  checkEnvRequirements,
  getTool,
  openaiSchemas,
} from "@freeanima/engine-tool";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import type { HookClarifyItem, HookStreamEvent, TurnControl } from "@freeanima/kernel-hooks";
import {
  headOkStepData,
  toolAfterCall,
  type HookRegistry,
  type ToolAfterCallEffect,
} from "@freeanima/kernel-hooks";
import * as llm from "@freeanima/engine-llm";
import { cleanToolCallsForApi } from "@freeanima/engine-llm";
import { markToolLoopActivity } from "@freeanima/engine-compress";
import { getToolSessionId, getToolRepos } from "./tool-context.ts";
import { maybeApplyEmergencyCompression } from "@freeanima/engine-conversation";
import { REPAIR_REASON_INTERRUPT } from "@freeanima/engine-llm";
import type { AssistantMessage, SessionMessage, ToolMessage } from "@freeanima/engine-conversation";
import type { OpenAiToolSchema } from "@freeanima/engine-conversation";

export class MaxTurnsExceeded extends Error {
  override name = "MaxTurnsExceeded";
}

export class EngineTurnInterrupted extends Error {
  override name = "EngineTurnInterrupted";
}

type EngineOpts = {
  max_turns?: number;
  model?: string;
  tools?: OpenAiToolSchema[];
  hookRegistry?: HookRegistry;
  onMessageAppended?: (msg: SessionMessage) => void | Promise<void>;
  onToolRoundComplete?: (msgs: SessionMessage[]) => void | Promise<void>;
  signal?: AbortSignal;
};

function withReasoning(
  msg: AssistantMessage,
  reasoning: string | null | undefined,
): AssistantMessage {
  if (reasoning) {
    return { ...msg, reasoning, reasoning_content: reasoning };
  }
  return msg;
}

function withStreamMeta(
  msg: AssistantMessage,
  meta: { usage?: Record<string, number> | null; latency_ms: number },
): AssistantMessage {
  const out: AssistantMessage = { ...msg, latency_ms: meta.latency_ms };
  if (meta.usage) out.usage = meta.usage;
  return out;
}

function cleanToolCalls(
  toolCalls: NonNullable<llm.LlmResponse["tool_calls"]>,
): ReturnType<typeof cleanToolCallsForApi> {
  return cleanToolCallsForApi(toolCalls);
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new EngineTurnInterrupted(REPAIR_REASON_INTERRUPT);
  }
}

function prepareEngine(opts?: {
  model?: string;
  tools?: OpenAiToolSchema[];
}): [OpenAiToolSchema[], string] {
  const missing = checkEnvRequirements();
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  const schemas: OpenAiToolSchema[] =
    opts?.tools && opts.tools.length > 0 ? opts.tools : openaiSchemas();
  const cfg = loadConfig();
  const resolved = opts?.model ?? getProfileHopModel(cfg, PROFILE_CHAT);
  return [schemas, resolved];
}

async function persistMessages(
  batch: SessionMessage[],
  opts?: Pick<EngineOpts, "onMessageAppended" | "onToolRoundComplete">,
): Promise<void> {
  if (!batch.length) return;
  if (opts?.onToolRoundComplete) {
    await opts.onToolRoundComplete(batch);
    return;
  }
  if (opts?.onMessageAppended) {
    for (const msg of batch) {
      await opts.onMessageAppended(msg);
    }
  }
}

async function persistToolRound(
  assistant: SessionMessage,
  tools: ToolMessage[],
  pendingCalls: ReturnType<typeof cleanToolCallsForApi>,
  executedCount: number,
  opts?: EngineOpts,
  interruptReason?: string,
): Promise<SessionMessage[]> {
  const batch: SessionMessage[] = [assistant, ...tools];
  if (interruptReason) {
    for (const tc of pendingCalls.slice(executedCount)) {
      const synthetic: ToolMessage = {
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: toolResult({ error: interruptReason }),
      };
      batch.push(synthetic);
      tools.push(synthetic);
    }
  }
  await persistMessages(batch, opts);
  return batch;
}

async function afterRuntimeMessage(
  messages: SessionMessage[],
  msg: SessionMessage,
  opts?: {
    model?: string;
    tools?: OpenAiToolSchema[];
    onMessageAppended?: (msg: SessionMessage) => void | Promise<void>;
  },
): Promise<void> {
  await persistMessages([msg], opts);
  const sessionId = getToolSessionId();
  if (!sessionId) return;
  if (
    msg.role === "tool" ||
    (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0)
  ) {
    markToolLoopActivity(sessionId);
  }
  const model = opts?.model;
  const tools = opts?.tools;
  if (model && tools) {
    const repos = getToolRepos();
    if (repos) {
      await maybeApplyEmergencyCompression(repos, sessionId, messages, { model, tools });
    }
  }
}

async function afterToolRoundBatch(
  messages: SessionMessage[],
  batch: SessionMessage[],
  opts?: { model?: string; tools?: OpenAiToolSchema[] },
): Promise<void> {
  const sessionId = getToolSessionId();
  if (!sessionId) return;
  if (batch.some((m) => m.role === "tool" || (m.role === "assistant" && m.tool_calls?.length))) {
    markToolLoopActivity(sessionId);
  }
  const model = opts?.model;
  const tools = opts?.tools;
  if (model && tools) {
    const repos = getToolRepos();
    if (repos) {
      await maybeApplyEmergencyCompression(repos, sessionId, messages, { model, tools });
    }
  }
}

async function runToolAfterCallHooks(
  hookRegistry: HookRegistry | undefined,
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  result: string,
): Promise<TurnControl | null> {
  if (!hookRegistry) return null;
  const hookRun = await hookRegistry.run(toolAfterCall, {
    sessionId,
    toolName,
    args,
    result,
  });
  const effect = (headOkStepData(hookRun.chain) ?? {}) as ToolAfterCallEffect;
  const tc = effect.turnControl;
  if (!tc?.pause || !Array.isArray(tc.streamEvents)) return null;
  return tc as TurnControl;
}

export async function run(messages: SessionMessage[], opts?: EngineOpts): Promise<string> {
  const parts: string[] = [];
  for await (const ev of runStream(messages, opts)) {
    switch (ev.event) {
      case "token":
        parts.push(ev.data.content);
        break;
      case "content_replace":
        parts.length = 0;
        parts.push(ev.data.content);
        break;
      case "error": {
        const msg = ev.data.error;
        if (msg.includes("Tool loop exceeded")) {
          throw new MaxTurnsExceeded(msg);
        }
        throw new Error(msg);
      }
      case "interrupted":
        throw new EngineTurnInterrupted(ev.data.reason);
      case "awaiting_clarify":
      case "tool_begin":
      case "tool_result":
      case "tool_error":
      case "done":
        break;
    }
  }
  return parts.join("").trim();
}

export type StreamDoneData = { reason?: "awaiting_clarify" | "interrupted" };

export type StreamEvent =
  | { event: "token"; data: { content: string } }
  | { event: "content_replace"; data: { content: string } }
  | { event: "tool_begin"; data: { name: string; args: Record<string, unknown> } }
  | { event: "tool_result"; data: { name: string; content: string } }
  | { event: "tool_error"; data: { name: string; content: string } }
  | {
      event: "awaiting_clarify";
      data: { items: HookClarifyItem[]; timeout_sec: number };
    }
  | { event: "interrupted"; data: { reason: string } }
  | { event: "done"; data: StreamDoneData }
  | { event: "error"; data: { error: string } };

function hookStreamToEngine(ev: HookStreamEvent): StreamEvent {
  return ev as StreamEvent;
}

export async function* runStream(
  messages: SessionMessage[],
  opts?: EngineOpts,
): AsyncGenerator<StreamEvent> {
  const maxTurns = opts?.max_turns ?? 98;
  const [toolSchemas, model] = prepareEngine(opts);
  const compiled = toolSchemas.length ? toolSchemas : undefined;
  const failureCounts = new Map<string, number>();
  const HARD = 8;

  for (let turn = 0; turn < maxTurns; turn++) {
    checkAborted(opts?.signal);
    const buffer: string[] = [];
    let toolCalls: llm.LlmResponse["tool_calls"] | undefined;
    let turnReasoning: string | null = null;
    let turnUsage: Record<string, number> | null = null;
    let turnFinishReason = "stop";
    const turnStarted = performance.now();

    try {
      for await (const chunk of llm.chatStream(messages, { tools: compiled, model })) {
        if (chunk.type === "content") {
          buffer.push(chunk.content);
          yield { event: "token", data: { content: chunk.content } };
        } else if (chunk.type === "tool_calls") {
          toolCalls = chunk.tool_calls;
        } else if (chunk.type === "done") {
          turnReasoning = chunk.reasoning ?? null;
          turnUsage = chunk.usage ?? null;
          turnFinishReason = chunk.finish_reason ?? turnFinishReason;
        }
      }
    } catch (e) {
      if (e instanceof EngineTurnInterrupted) {
        yield { event: "interrupted", data: { reason: e.message } };
        yield { event: "done", data: { reason: "interrupted" } };
        return;
      }
      const msg = `LLM 调用失败: ${e}`;
      logComponent("engine").error(msg, { err: e });
      yield { event: "error", data: { error: msg } };
      return;
    }

    const turnLatencyMs = Math.round(performance.now() - turnStarted);
    const streamMeta = { usage: turnUsage, latency_ms: turnLatencyMs };

    if (!toolCalls?.length) {
      const text = buffer.join("");
      const pushed = withStreamMeta(
        withReasoning(
          {
            role: "assistant",
            content: text,
            model,
            finish_reason: turnFinishReason,
          },
          turnReasoning,
        ),
        streamMeta,
      );
      messages.push(pushed);
      await afterRuntimeMessage(messages, pushed, {
        ...opts,
        model,
        tools: toolSchemas,
      });
      yield { event: "done", data: {} };
      return;
    }

    const cleanedCalls = cleanToolCalls(toolCalls);
    const withTools = withStreamMeta(
      withReasoning(
        {
          role: "assistant",
          content: buffer.join("") || null,
          tool_calls: cleanedCalls,
          model,
          finish_reason: turnFinishReason,
        },
        turnReasoning,
      ),
      streamMeta,
    );

    let turnControl: TurnControl | null = null;
    messages.push(withTools);
    const toolMsgs: ToolMessage[] = [];

    try {
      for (const tc of cleanedCalls) {
        checkAborted(opts?.signal);
        const fnName = (tc.function?.name ?? "").trim() || "unknown";
        const argsResult = parseToolArgs(tc.function.arguments);
        const fnArgs = argsResult.ok ? argsResult.data : {};
        yield { event: "tool_begin", data: { name: fnName, args: fnArgs } };
        const tool = getTool(fnName);
        let result: string;
        if (!tool) {
          result = toolResult({ error: `Unknown tool: ${fnName}` });
        } else if (!argsResult.ok) {
          result = toolError(argsResult.error);
        } else {
          try {
            result = await Promise.resolve(tool.handler(fnArgs));
            if (typeof result !== "string") result = toolResult(result);
            failureCounts.delete(fnName);
          } catch (exc) {
            result = toolResult({ error: `${fnName} failed: ${exc}` });
            const count = (failureCounts.get(fnName) ?? 0) + 1;
            failureCounts.set(fnName, count);
            if (count >= HARD) {
              throw new Error(
                `Tool '${fnName}' failed ${count} times consecutively. Last: ${exc}`,
                { cause: exc },
              );
            }
          }
        }
        const sessionId = getToolSessionId() ?? "";
        const control = await runToolAfterCallHooks(
          opts?.hookRegistry,
          sessionId,
          fnName,
          fnArgs,
          result,
        );
        if (control) turnControl = control;
        const toolMsg: ToolMessage = {
          role: "tool",
          tool_call_id: tc.id,
          name: fnName,
          content: result,
        };
        toolMsgs.push(toolMsg);
        messages.push(toolMsg);
        yield { event: "tool_result", data: { name: fnName, content: result } };
      }

      const batch = await persistToolRound(
        withTools,
        toolMsgs,
        cleanedCalls,
        cleanedCalls.length,
        opts,
      );
      await afterToolRoundBatch(messages, batch, { model, tools: toolSchemas });
    } catch (e) {
      if (e instanceof EngineTurnInterrupted) {
        const batch = await persistToolRound(
          withTools,
          toolMsgs,
          cleanedCalls,
          toolMsgs.length,
          opts,
          REPAIR_REASON_INTERRUPT,
        );
        for (const m of batch.slice(toolMsgs.length + 1)) {
          if (m.role === "tool") messages.push(m);
        }
        await afterToolRoundBatch(messages, batch, { model, tools: toolSchemas });
        yield { event: "interrupted", data: { reason: e.message } };
        yield { event: "done", data: { reason: "interrupted" } };
        return;
      }
      throw e;
    }

    if (turnControl) {
      for (const ev of turnControl.streamEvents) {
        yield hookStreamToEngine(ev);
      }
      return;
    }
  }

  const msg = `Tool loop exceeded ${maxTurns} turns`;
  logComponent("engine").error(msg);
  yield { event: "error", data: { error: msg } };
}
