import type { LlmTurnMessage } from "@freeanima/host/core/provider";
import {
  assistantReasoningText,
  type AssistantMessage,
  type StoredMessage,
} from "@freeanima/host/core/db/domain";
import { cleanToolCallsForApi } from "@freeanima/host/core/provider/stream-tools";
import { omitUndefined } from "@freeanima/host/core/util";
import { isRuntimeSystemTurn } from "./runtime-system-turn.ts";
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
  const text = (msg.content ?? "").trim() || assistantReasoningText(msg);
  if (!text) return null;
  const { tool_calls: _removed, ...rest } = msg;
  return { ...rest, role: "assistant", content: text };
}

export type InvokeMessageInput = {
  turns: LlmTurnMessage[];
  systemPrompt?: string;
};

/**
 * StoredMessage[] → LlmTurnMessage + separate systemPrompt。
 * 无名 system → systemPrompt（不限是否 leading，避免 runtime 注入插到 system 前时丢提示词）；
 * 具名 runtime system → turns。
 */
export function storedMessagesToInvokeInput(messages: StoredMessage[]): InvokeMessageInput {
  const repaired = repairToolLoopMessages(messages);
  const systemParts: string[] = [];
  const turns: LlmTurnMessage[] = [];

  for (const msg of repaired) {
    if (msg.role === "system") {
      if (isRuntimeSystemTurn(msg)) {
        turns.push({
          role: "system",
          content: msg.content,
          ...(msg.name ? { name: msg.name } : {}),
        });
      } else if (msg.content) {
        systemParts.push(msg.content);
      }
      continue;
    }
    if (msg.role === "assistant") {
      const normalized = normalizeAssistantTurn(msg);
      if (normalized) turns.push(normalized);
      continue;
    }
    turns.push(msg);
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
