import type { LlmTurnMessage } from "@freeanima/engine-provider-llm";
import {
  assistantReasoningText,
  type AssistantMessage,
  type SessionMessage,
} from "@freeanima/engine-db/domain";
import { cleanToolCallsForApi } from "@freeanima/engine-provider-llm/stream-tools";
import { repairToolLoopMessages } from "./tool-loop-integrity.ts";

/** Ensure assistant has content or valid tool_calls before sending to provider */
export function normalizeAssistantTurn(msg: AssistantMessage): LlmTurnMessage | null {
  const cleaned = msg.tool_calls?.length ? cleanToolCallsForApi(msg.tool_calls) : [];
  if (cleaned.length) {
    return {
      ...msg,
      content: msg.content ?? null,
      tool_calls: cleaned,
    };
  }
  const text = String(msg.content ?? "").trim() || assistantReasoningText(msg);
  if (!text) return null;
  const { tool_calls: _removed, ...rest } = msg;
  return { ...rest, role: "assistant", content: text };
}

export type InvokeMessageInput = {
  turns: LlmTurnMessage[];
  systemPrompt?: string;
};

/** SessionMessage[] → LlmTurnMessage + separate systemPrompt (strip leading system) */
export function sessionMessagesToInvokeInput(messages: SessionMessage[]): InvokeMessageInput {
  const repaired = repairToolLoopMessages(messages);
  const systemParts: string[] = [];
  const turns: LlmTurnMessage[] = [];
  let pastLeadingSystem = false;

  for (const msg of repaired) {
    if (msg.role === "session_meta") continue;
    if (!pastLeadingSystem && msg.role === "system") {
      systemParts.push(msg.content);
      continue;
    }
    pastLeadingSystem = true;
    if (msg.role === "system") continue;
    if (msg.role === "assistant") {
      const normalized = normalizeAssistantTurn(msg);
      if (normalized) turns.push(normalized);
      continue;
    }
    turns.push(msg as LlmTurnMessage);
  }

  const systemPrompt = systemParts.length ? systemParts.join("\n") : undefined;
  return { turns, systemPrompt };
}

export type SimpleChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Simple message lists for reflect / summary etc. */
export function simpleMessagesToInvokeInput(messages: SimpleChatMessage[]): InvokeMessageInput {
  let systemPrompt: string | undefined;
  const turns: LlmTurnMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemPrompt = systemPrompt ? `${systemPrompt}\n${msg.content}` : msg.content;
      continue;
    }
    if (msg.role === "user") {
      turns.push({ role: "user", content: msg.content });
    } else {
      turns.push({ role: "assistant", content: msg.content });
    }
  }

  return { turns, systemPrompt };
}
