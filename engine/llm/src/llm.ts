import type { ChatCompletion } from "@freeanima/engine-provider-llm";
import { PROFILE_CHAT, PROFILE_REFLECT, PROFILE_SUMMARY } from "@freeanima/engine-provider-llm";
import type { OpenAiToolSchema, ToolCall } from "@freeanima/kernel-schemas";
import type { LlmCallParams } from "@freeanima/engine-provider-llm";
import type { SessionMessage } from "@freeanima/kernel-schemas";
import {
  cleanToolCallsForApi,
  finalizeStreamingToolCalls,
  mergeStreamingToolCalls,
} from "@freeanima/capabilities-provider-openai-compatible/stream-tools";
import { getLlmRuntime } from "./llm-stack.ts";
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
};

function resolveProfileId(profileId?: string): string {
  return profileId ?? PROFILE_CHAT;
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
  const profile = getLlmRuntime().profiles.resolve(resolveProfileId(opts?.profileId));
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
  const profile = getLlmRuntime().profiles.resolve(resolveProfileId(opts?.profileId));
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
export { normalizeUsage } from "@freeanima/capabilities-provider-openai-compatible/usage";
