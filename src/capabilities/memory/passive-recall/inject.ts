import { formatMemoryReferenceMarker } from "@freeanima/core/db/pg/memory-reference/markers";
import type { AssistantMessage, StoredMessage } from "@freeanima/core/db/domain";
import { PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME } from "@freeanima/core/llm/runtime-system-turn";

import type { SemanticRecallHit } from "../recall-search.ts";

export { PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME };

export const PASSIVE_MEMORY_CONTEXT_HEAD =
  "以下是与当前用户消息相关的语义记忆。有依据时使用，并在回复末尾引用 [[anima:id]]。";

export const PASSIVE_MEMORY_CONTEXT_FENCE = "memory";

export function isPassiveMemoryContextAssistant(msg: StoredMessage): msg is AssistantMessage {
  return msg.role === "assistant" && msg.name === PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME;
}

/** @deprecated 使用 isPassiveMemoryContextAssistant */
export const isPassiveMemoryContextSystem = isPassiveMemoryContextAssistant;

function formatPassiveMemoryLine(hit: SemanticRecallHit): string {
  const marker = formatMemoryReferenceMarker(hit.semantic_memory_id);
  return `${marker} ${hit.content}`;
}

export function formatPassiveMemoryBlock(hits: SemanticRecallHit[], maxChars: number): string {
  const lines: string[] = [];
  let used = 0;
  for (const hit of hits) {
    const line = formatPassiveMemoryLine(hit);
    const next = used === 0 ? line.length : used + 1 + line.length;
    if (next > maxChars) break;
    lines.push(line);
    used = next;
  }
  if (lines.length === 0) return "";
  return "```" + PASSIVE_MEMORY_CONTEXT_FENCE + "\n" + lines.join("\n") + "\n```";
}

export function wrapPassiveMemoryContext(hits: SemanticRecallHit[], maxChars: number): string {
  const block = formatPassiveMemoryBlock(hits, maxChars);
  if (!block) return "";
  return `${PASSIVE_MEMORY_CONTEXT_HEAD}\n\n${block}`;
}

export function stripPassiveMemoryContextFromMessages(messages: StoredMessage[]): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg !== undefined && isPassiveMemoryContextAssistant(msg)) {
      messages.splice(i, 1);
    }
  }
}

/** Manifest passive recall as runtime-only assistant immediately before the last user message. */
export function manifestPassiveMemoryContext(
  messages: StoredMessage[],
  hits: SemanticRecallHit[],
  maxChars: number,
): void {
  const lastIdx = messages.length - 1;
  const lastMsg = messages[lastIdx];
  if (!lastMsg || lastMsg.role !== "user") return;

  const content = wrapPassiveMemoryContext(hits, maxChars);
  if (!content.trim()) return;

  const manifest: AssistantMessage = {
    role: "assistant",
    name: PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME,
    content,
  };
  messages.splice(lastIdx, 0, manifest);
}
