import type { LlmTurnMessage } from "@freeanima/core/provider";
import {
  assistantReasoningText,
  type AssistantMessage,
  type StoredMessage,
} from "@freeanima/core/db/domain";
import { cleanToolCallsForApi } from "@freeanima/core/provider/stream-tools";
import { omitUndefined } from "@freeanima/core/util";
import { repairToolLoopMessages } from "./tool-loop-integrity.ts";

/** Ensure assistant has content or valid tool_calls before sending to provider */
export function normalizeAssistantTurn(msg: AssistantMessage): LlmTurnMessage | null {
  const cleaned = msg.tool_calls?.length ? cleanToolCallsForApi(msg.tool_calls) : [];
  if (cleaned.length > 0) {
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

/** StoredMessage[] → LlmTurnMessage + separate systemPrompt (strip leading system) */
export function storedMessagesToInvokeInput(messages: StoredMessage[]): InvokeMessageInput {
  const repaired = repairToolLoopMessages(messages);
  const systemParts: string[] = [];
  const turns: LlmTurnMessage[] = [];
  let pastLeadingSystem = false;

  for (const msg of repaired) {
    if (msg.role === "conversation_meta") continue;
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

  const systemPrompt = systemParts.length > 0 ? systemParts.join("\n") : undefined;
  return omitUndefined({ turns, systemPrompt });
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

  return omitUndefined({ turns, systemPrompt });
}
