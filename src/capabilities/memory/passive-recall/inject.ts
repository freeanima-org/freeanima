import { formatMemoryReferenceMarker } from "@freeanima/core/repos";
import type { SystemMessage, StoredMessage } from "@freeanima/core/db/domain";
import { PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME } from "@freeanima/core/llm/runtime-system-turn";

import type { SemanticRecallHit } from "../recall-search.ts";

export const PASSIVE_MEMORY_CONTEXT_HEAD =
  "以下是与当前用户消息相关的语义记忆。有依据时使用，并在回复末尾引用 [[f-id]]。";

export const PASSIVE_MEMORY_CONTEXT_FENCE = "memory";

export function isPassiveMemoryContextSystem(msg: StoredMessage): msg is SystemMessage {
  return msg.role === "system" && msg.name === PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME;
}

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
    if (msg !== undefined && isPassiveMemoryContextSystem(msg)) {
      messages.splice(i, 1);
    }
  }
}

/** Manifest passive recall as runtime-only system immediately before the last user message. */
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

  const manifest: SystemMessage = {
    role: "system",
    name: PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME,
    content,
  };
  messages.splice(lastIdx, 0, manifest);
}
