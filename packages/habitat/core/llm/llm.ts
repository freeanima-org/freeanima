import type { ChatCompletion } from "@freeanima/habitat/core/provider";
import { PROFILE_REFLECT, PROFILE_SUMMARY } from "@freeanima/habitat/core/provider";
import type { OpenAiToolSchema, ToolCall } from "@freeanima/habitat/core/db/domain";
import type { LlmCallParams } from "@freeanima/habitat/core/provider";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import {
  cleanToolCallsForApi,
  finalizeStreamingToolCalls,
  mergeStreamingToolCalls,
} from "@freeanima/habitat/core/provider/stream-tools";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { getLlmRuntime, type LlmRuntime } from "./llm-stack.ts";
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
  /** When omitted, uses module-level runtime from initLlmRuntime() */
  runtime?: LlmRuntime;
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
  const profile = resolveRuntime(opts).profiles.resolve(opts?.profileId);
  const input = isSimpleChatOnly(messages)
    ? simpleMessagesToInvokeInput(messages as SimpleChatMessage[])
    : storedMessagesToInvokeInput(messages);

  return profile.chat(
    input.turns,
    omitUndefined({
      model: opts?.model,
      systemPrompt: input.systemPrompt,
      tools: opts?.tools,
      requestParams: opts?.requestParams,
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
  const profile = resolveRuntime(opts).profiles.resolve(opts?.profileId);
  const input = storedMessagesToInvokeInput(messages);

  for await (const event of profile.chatStream(
    input.turns,
    omitUndefined({
      model: opts?.model,
      systemPrompt: input.systemPrompt,
      tools: opts?.tools,
      requestParams: opts?.requestParams,
    }),
  )) {
    yield event;
  }
}

function isSimpleChatOnly(messages: StoredMessage[] | SimpleChatMessage[]): boolean {
  return messages.every((m) => m.role === "system" || m.role === "user" || m.role === "assistant");
}

export { PROFILE_REFLECT, PROFILE_SUMMARY };
export { normalizeUsage } from "@freeanima/habitat/core/provider/usage";
