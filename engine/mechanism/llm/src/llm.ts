import type { ChatCompletion } from "@freeanima/engine-provider-llm";
import { PROFILE_CHAT, PROFILE_REFLECT, PROFILE_SUMMARY } from "@freeanima/engine-provider-llm";
import type { OpenAiToolSchema, ToolCall } from "@freeanima/engine-db/domain";
import type { LlmCallParams } from "@freeanima/engine-provider-llm";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import {
  cleanToolCallsForApi,
  finalizeStreamingToolCalls,
  mergeStreamingToolCalls,
} from "@freeanima/engine-provider-llm/stream-tools";
import { getLlmRuntime, type LlmRuntime } from "./llm-stack.ts";
import {
  sessionMessagesToInvokeInput,
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

function resolveProfileId(profileId?: string): string {
  return profileId ?? PROFILE_CHAT;
}

function resolveRuntime(opts?: LlmInvokeOpts): LlmRuntime {
  return opts?.runtime ?? getLlmRuntime();
}

export async function chat(messages: SessionMessage[], opts?: LlmInvokeOpts): Promise<LlmResponse>;
export async function chat(
  messages: SimpleChatMessage[],
  opts?: LlmInvokeOpts,
): Promise<LlmResponse>;
export async function chat(
  messages: SessionMessage[] | SimpleChatMessage[],
  opts?: LlmInvokeOpts,
): Promise<LlmResponse> {
  const profile = resolveRuntime(opts).profiles.resolve(resolveProfileId(opts?.profileId));
  const input = isSimpleChatOnly(messages)
    ? simpleMessagesToInvokeInput(messages as SimpleChatMessage[])
    : sessionMessagesToInvokeInput(messages as SessionMessage[]);

  return profile.chat(input.turns, {
    model: opts?.model,
    systemPrompt: input.systemPrompt,
    tools: opts?.tools,
    requestParams: opts?.requestParams,
  });
}

export async function* chatStream(
  messages: SessionMessage[],
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
  const profile = resolveRuntime(opts).profiles.resolve(resolveProfileId(opts?.profileId));
  const input = sessionMessagesToInvokeInput(messages);

  for await (const event of profile.chatStream(input.turns, {
    model: opts?.model,
    systemPrompt: input.systemPrompt,
    tools: opts?.tools,
    requestParams: opts?.requestParams,
  })) {
    yield event;
  }
}

function isSimpleChatOnly(messages: SessionMessage[] | SimpleChatMessage[]): boolean {
  return messages.every((m) => m.role === "system" || m.role === "user" || m.role === "assistant");
}

export { PROFILE_REFLECT, PROFILE_SUMMARY };
export { normalizeUsage } from "@freeanima/engine-provider-llm/usage";
