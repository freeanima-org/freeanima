import type { LlmTurnMessage } from "@freeanima/legacy-db";
import type { SessionMessage } from "@freeanima/legacy-kernel";
import { repairToolLoopMessages } from "./tool-loop-integrity.js";

export type InvokeMessageInput = {
  turns: LlmTurnMessage[];
  systemPrompt?: string;
};

/** SessionMessage[] → LlmTurnMessage + 独立 systemPrompt（剥离首部连续 system） */
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
    turns.push(msg as LlmTurnMessage);
  }

  const systemPrompt = systemParts.length ? systemParts.join("\n") : undefined;
  return { turns, systemPrompt };
}

export type SimpleChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** reflect / 摘要等简单消息列表 */
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
