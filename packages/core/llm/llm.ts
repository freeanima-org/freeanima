import type { ChatCompletion } from "@freeanima/core/provider";
import { PROFILE_REFLECT, PROFILE_SUMMARY } from "@freeanima/core/provider";
import type { OpenAiToolSchema, ToolCall } from "@freeanima/core/db/domain";
import type { LlmCallParams } from "@freeanima/core/provider";
import type { StoredMessage } from "@freeanima/core/db/domain";
import {
  cleanToolCallsForApi,
  finalizeStreamingToolCalls,
  mergeStreamingToolCalls,
} from "@freeanima/core/provider/stream-tools";
import { omitUndefined } from "@freeanima/core/util";
import type { LlmRuntime } from "./llm-stack.ts";
import { getLlmRuntime } from "./llm-stack-runtime.ts";
import {
  storedMessagesToInvokeInput,
  simpleMessagesToInvokeInput,
  type SimpleChatMessage,
} from "./llm-adapt.ts";

export type LlmResponse = ChatCompletion;

export type StreamToolCall = ToolCall;

export { cleanToolCallsForApi, finalizeStreamingToolCalls, mergeStreamingToolCalls };

export type LlmInvokeOpts = {
  model?: string;
  tools?: OpenAiToolSchema[];
  profileId?: string;
  requestParams?: Partial<LlmCallParams>;
  /** When omitted, resolves the active runtime from `ctx.llmStack` */
  runtime?: LlmRuntime;
  /** 用户中断 / 墙钟取消；下传到 Profile → provider fetch */
  signal?: AbortSignal;
};

function resolveRuntime(opts?: LlmInvokeOpts): LlmRuntime {
  return opts?.runtime ?? getLlmRuntime();
}

export async function chat(messages: StoredMessage[], opts?: LlmInvokeOpts): Promise<LlmResponse>;
export async function chat(
  messages: SimpleChatMessage[],
  opts?: LlmInvokeOpts,
): Promise<LlmResponse>;
export async function chat(
  messages: StoredMessage[] | SimpleChatMessage[],
  opts?: LlmInvokeOpts,
): Promise<LlmResponse> {
  const resolvedId = resolveRuntime(opts).resolveProfileId(opts?.profileId);
  const profile = resolveRuntime(opts).profiles.resolve(resolvedId);
  const input = isSimpleChatOnly(messages)
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- isSimpleChatOnly 已收窄
      simpleMessagesToInvokeInput(messages as SimpleChatMessage[])
    : storedMessagesToInvokeInput(messages);

  return profile.chat(
    input.turns,
    omitUndefined({
      model: opts?.model,
      systemPrompt: input.systemPrompt,
      tools: opts?.tools,
      requestParams: opts?.requestParams,
      signal: opts?.signal,
    }),
  );
}

export async function* chatStream(
  messages: StoredMessage[],
  opts?: LlmInvokeOpts,
): AsyncGenerator<
  | { type: "content"; content: string }
  | { type: "tool_calls"; tool_calls: ToolCall[] }
  | {
      type: "done";
      reasoning?: string | null;
      usage?: Record<string, number> | null;
      finish_reason?: string | null;
      model?: string;
    }
> {
  const resolvedId = resolveRuntime(opts).resolveProfileId(opts?.profileId);
  const profile = resolveRuntime(opts).profiles.resolve(resolvedId);
  const input = storedMessagesToInvokeInput(messages);

  for await (const event of profile.chatStream(
    input.turns,
    omitUndefined({
      model: opts?.model,
      systemPrompt: input.systemPrompt,
      tools: opts?.tools,
      requestParams: opts?.requestParams,
      signal: opts?.signal,
    }),
  )) {
    yield event;
  }
}

function isSimpleChatOnly(messages: StoredMessage[] | SimpleChatMessage[]): boolean {
  return messages.every((m) => m.role === "system" || m.role === "user" || m.role === "assistant");
}

export { PROFILE_REFLECT, PROFILE_SUMMARY };
export { normalizeUsage } from "@freeanima/core/provider/usage";
