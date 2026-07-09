import { parseToolArgs, toolError, toolResult } from "@freeanima/core/tool";
import {
  getActiveRuntimeConfig,
  getProfileHopModel,
  getRuntimeLogger,
  type AnimaConfig,
} from "@freeanima/core/config";
import type { Logger } from "@freeanima/kernel/logging";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import type { HookClarifyItem, HookStreamEvent, TurnControl } from "@freeanima/core/hooks/loop";
import {
  beforeLlmCall,
  toolAfterCall,
  type BeforeLlmCallContext,
} from "@freeanima/core/hooks/loop";
import { headOkStepData, type HookRegistry } from "@freeanima/kernel/hooks";
import * as llm from "@freeanima/core/llm";
import type { LlmRuntime } from "@freeanima/core/llm";
import { cleanToolCallsForApi } from "@freeanima/core/llm";
import { markToolLoopActivity, maybeApplyEmergencyCompression } from "@freeanima/core/compress";
import { omitUndefined } from "@freeanima/core/util";
import {
  getToolRegistry,
  getToolConversationId,
  isExecutableTool,
  type ToolSetRegistry,
} from "@freeanima/core/tool";
import { REPAIR_REASON_INTERRUPT } from "@freeanima/core/llm";
import {
  resolveMaxTurns,
  type AssistantMessage,
  type StoredMessage,
  type ToolMessage,
  type OpenAiToolSchema,
} from "@freeanima/core/db/domain";
import { buildLlmDebugSnapshot, type LlmDebugSnapshot } from "./llm-debug-snapshot.ts";

export class MaxTurnsExceeded extends Error {
  override name = "MaxTurnsExceeded";
}

export class EngineTurnInterrupted extends Error {
  override name = "EngineTurnInterrupted";
}

type EngineOpts = {
  max_turns?: number;
  model?: string;
  config?: AnimaConfig;
  logger?: Logger;
  /** Injected LLM runtime; falls back to initLlmRuntime() singleton when omitted */
  llm?: LlmRuntime;
  tools?: OpenAiToolSchema[];
  /** Injected tool registry; falls back to getToolRegistry() when omitted */
  toolRegistry?: ToolSetRegistry;
  /** Tool names allowed by capability mask (ResolvedMask.allowed_tools); no fallback block when unset */
  toolMask?: { allowedTools: readonly string[] };
  /** Executable tool names (cached + staged toolsets); no loaded gate when unset */
  executableTools?: readonly string[];
  hookRegistry?: HookRegistry;
  onMessageAppended?: (msg: StoredMessage) => void | Promise<void>;
  onToolRoundComplete?: (msgs: StoredMessage[]) => void | Promise<void>;
  signal?: AbortSignal;
  /** Returns true on process shutdown; engine interrupts before next LLM / tool round */
  shouldStop?: () => boolean;
  /** Emit ephemeral llm_debug stream events (initial + final snapshots) */
  llm_debug?: boolean;
};

export type RuntimeToolMask = NonNullable<EngineOpts["toolMask"]>;

function resolveToolRegistry(opts?: Pick<EngineOpts, "toolRegistry">): ToolSetRegistry {
  return opts?.toolRegistry ?? getToolRegistry();
}

function withReasoning(
  msg: AssistantMessage,
  reasoning: string | null | undefined,
): AssistantMessage {
  if (reasoning) {
    return { ...msg, reasoning };
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

function checkShouldStop(opts?: Pick<EngineOpts, "signal" | "shouldStop">): void {
  checkAborted(opts?.signal);
  if (opts?.shouldStop?.()) {
    throw new EngineTurnInterrupted("Service is shutting down");
  }
}

function prepareEngine(
  opts?: Pick<EngineOpts, "model" | "tools" | "config" | "toolRegistry">,
): [OpenAiToolSchema[], string] {
  const registry = resolveToolRegistry(opts);
  const missing = registry.checkEnvRequirements();
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  const schemas: OpenAiToolSchema[] =
    opts?.tools && opts.tools.length > 0 ? opts.tools : registry.openaiSchemas();
  const cfg = opts?.config ?? getActiveRuntimeConfig().data;
  const resolved = opts?.model ?? getProfileHopModel(cfg, PROFILE_CHAT);
  return [schemas, resolved];
}

async function persistMessages(
  batch: StoredMessage[],
  opts?: Pick<EngineOpts, "onMessageAppended" | "onToolRoundComplete">,
): Promise<void> {
  if (batch.length === 0) return;
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
  assistant: StoredMessage,
  tools: ToolMessage[],
  pendingCalls: ReturnType<typeof cleanToolCallsForApi>,
  executedCount: number,
  opts?: EngineOpts,
  interruptReason?: string,
): Promise<StoredMessage[]> {
  const batch: StoredMessage[] = [assistant, ...tools];
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
  messages: StoredMessage[],
  msg: StoredMessage,
  opts?: Pick<EngineOpts, "model" | "tools" | "onMessageAppended" | "onToolRoundComplete">,
): Promise<void> {
  await persistMessages([msg], opts);
  const conversationId = getToolConversationId();
  if (!conversationId) return;
  if (
    msg.role === "tool" ||
    (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0)
  ) {
    markToolLoopActivity(conversationId);
  }
  const model = opts?.model;
  const tools = opts?.tools;
  if (model && tools) {
    await maybeApplyEmergencyCompression(conversationId, messages, { model, tools });
  }
}

async function afterToolRoundBatch(
  messages: StoredMessage[],
  batch: StoredMessage[],
  opts?: Pick<EngineOpts, "model" | "tools">,
): Promise<void> {
  const conversationId = getToolConversationId();
  if (!conversationId) return;
  if (batch.some((m) => m.role === "tool" || (m.role === "assistant" && m.tool_calls?.length))) {
    markToolLoopActivity(conversationId);
  }
  const model = opts?.model;
  const tools = opts?.tools;
  if (model && tools) {
    await maybeApplyEmergencyCompression(conversationId, messages, { model, tools });
  }
}

async function runToolAfterCallHooks(
  hookRegistry: HookRegistry | undefined,
  conversationId: string,
  toolName: string,
  args: Record<string, unknown>,
  result: string,
): Promise<TurnControl | null> {
  if (!hookRegistry) return null;
  const hookRun = await hookRegistry.run(toolAfterCall, {
    conversationId,
    toolName,
    args,
    result,
  });
  const effect = headOkStepData(toolAfterCall, hookRun.chain);
  const tc = effect?.turnControl;
  if (!tc?.pause || !Array.isArray(tc.streamEvents)) return null;
  return tc as TurnControl;
}

export async function run(messages: StoredMessage[], opts?: EngineOpts): Promise<string> {
  const parts: string[] = [];
  for await (const ev of runStream(messages, opts)) {
    switch (ev.event) {
      case "accepted":
        break;
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
      case "tool_round_end":
      case "llm_debug":
      case "done":
        break;
    }
  }
  return parts.join("").trim();
}

export type StreamDoneData = { reason?: "awaiting_clarify" | "interrupted" };

export type StreamEvent =
  | { event: "accepted"; data: Record<string, never> }
  | { event: "token"; data: { content: string } }
  | { event: "content_replace"; data: { content: string } }
  | { event: "tool_begin"; data: { name: string; args: Record<string, unknown> } }
  | { event: "tool_result"; data: { name: string; content: string } }
  | { event: "tool_error"; data: { name: string; content: string } }
  | { event: "tool_round_end"; data: { tool_count: number } }
  | {
      event: "awaiting_clarify";
      data: { items: HookClarifyItem[]; timeout_sec: number };
    }
  | { event: "interrupted"; data: { reason: string } }
  | { event: "llm_debug"; data: LlmDebugSnapshot }
  | { event: "done"; data: StreamDoneData }
  | { event: "error"; data: { error: string } };

function hookStreamToEngine(ev: HookStreamEvent): StreamEvent {
  return ev as StreamEvent;
}

export async function* runStream(
  messages: StoredMessage[],
  opts?: EngineOpts,
): AsyncGenerator<StreamEvent> {
  const maxTurns = resolveMaxTurns(opts);
  const [toolSchemas, model] = prepareEngine(opts);
  const compiled = toolSchemas.length > 0 ? toolSchemas : undefined;
  const failureCounts = new Map<string, number>();
  const HARD = 8;

  let lastDebugSnapshot: LlmDebugSnapshot | null = null;

  for (let turn = 0; turn < maxTurns; turn++) {
    checkShouldStop(opts);
    // Run beforeLlmCall hook; modules (e.g. notifications) may modify messages before LLM inference
    if (opts?.hookRegistry) {
      await opts.hookRegistry.run(beforeLlmCall, {
        conversationId: getToolConversationId() ?? "",
        messages: messages as BeforeLlmCallContext["messages"],
      });
    }

    if (opts?.llm_debug) {
      if (turn === 0) {
        yield {
          event: "llm_debug",
          data: buildLlmDebugSnapshot(messages, toolSchemas, model, turn, "initial"),
        };
      }
      lastDebugSnapshot = buildLlmDebugSnapshot(messages, toolSchemas, model, turn, "final");
    }

    const buffer: string[] = [];
    let toolCalls: llm.LlmResponse["tool_calls"] | undefined;
    let turnReasoning: string | null = null;
    let turnUsage: Record<string, number> | null = null;
    let turnFinishReason = "stop";
    const turnStarted = performance.now();

    try {
      for await (const chunk of llm.chatStream(
        messages,
        omitUndefined({
          tools: compiled,
          model,
          runtime: opts?.llm,
        }),
      )) {
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
      const msg = `LLM call failed: ${e}`;
      (opts?.logger ?? getRuntimeLogger()).with({ component: "engine" }).error(msg, { err: e });
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
      if (opts?.llm_debug && lastDebugSnapshot) {
        yield { event: "llm_debug", data: lastDebugSnapshot };
      }
      yield { event: "done", data: {} };
      return;
    }

    const cleanedCalls = cleanToolCalls(toolCalls);
    if (cleanedCalls.length === 0) {
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
      if (opts?.llm_debug && lastDebugSnapshot) {
        yield { event: "llm_debug", data: lastDebugSnapshot };
      }
      yield { event: "done", data: {} };
      return;
    }
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
        checkShouldStop(opts);
        const fnName = (tc.function?.name ?? "").trim() || "unknown";
        const argsResult = parseToolArgs(tc.function.arguments);
        const fnArgs = argsResult.ok ? argsResult.data : {};
        yield { event: "tool_begin", data: { name: fnName, args: fnArgs } };
        const tool = resolveToolRegistry(opts).getTool(fnName);
        let result: string;
        if (opts?.toolMask && !opts.toolMask.allowedTools.includes(fnName)) {
          result = toolError("Tool restricted by capability mask");
        } else {
          const ctxExec = isExecutableTool(fnName);
          const blockedByLoaded =
            ctxExec === false ||
            (ctxExec === undefined &&
              opts?.executableTools != null &&
              !opts.executableTools.includes(fnName));
          if (blockedByLoaded) {
            result = toolError("Tool not loaded; call toolset_load first");
          } else if (!tool) {
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
        }
        const conversationId = getToolConversationId() ?? "";
        const control = await runToolAfterCallHooks(
          opts?.hookRegistry,
          conversationId,
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
      yield { event: "tool_round_end", data: { tool_count: cleanedCalls.length } };
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
        if (toolMsgs.length > 0) {
          yield { event: "tool_round_end", data: { tool_count: toolMsgs.length } };
        }
        yield { event: "interrupted", data: { reason: e.message } };
        yield { event: "done", data: { reason: "interrupted" } };
        return;
      }
      throw e;
    }

    if (turnControl) {
      if (opts?.llm_debug && lastDebugSnapshot) {
        yield { event: "llm_debug", data: lastDebugSnapshot };
      }
      for (const ev of turnControl.streamEvents) {
        yield hookStreamToEngine(ev);
      }
      return;
    }
  }

  const msg = `Tool loop exceeded ${maxTurns} turns`;
  (opts?.logger ?? getRuntimeLogger()).with({ component: "engine" }).error(msg);
  yield { event: "error", data: { error: msg } };
}
