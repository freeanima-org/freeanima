import type { SessionMessage } from "@freeanima/core/db/domain";
import type { FridgeMagnet } from "./types.ts";

export const FRIDGE_MAGNET_FENCE = "fridge-magnet";

const FRIDGE_BLOCK_RE = /^```(?:fridge-magnet|fridge)\n[\s\S]*?\n```\n?/;

/** Format fridge magnet list as Markdown code block */
export function formatFridgeMagnets(magnets: FridgeMagnet[]): string {
  const lines = magnets.filter((m) => m.value.trim().length > 0).map((m) => `${m.key}: ${m.value}`);
  if (lines.length === 0) return "";
  return "```" + FRIDGE_MAGNET_FENCE + "\n" + lines.join("\n") + "\n```\n";
}

/** Inject fridge magnet block before message content */
export function injectFridgeMagnets(content: string, magnets: FridgeMagnet[]): string {
  const block = formatFridgeMagnets(magnets);
  if (!block) return content;
  return block + content;
}

/** Strip fridge magnet block from message content (idempotent) */
export function stripFridgeMagnets(content: string): string {
  return content.replace(FRIDGE_BLOCK_RE, "");
}

/** Find last user message and inject fridge magnets */
export function injectIntoMessages(messages: SessionMessage[], magnets: FridgeMagnet[]): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === "user" && "content" in msg) {
      msg.content = injectFridgeMagnets(msg.content ?? "", magnets);
      return;
    }
  }
}

/** strips fridge magnet blocks from all user messages */
export function stripAllFromMessages(messages: SessionMessage[]): void {
  for (const msg of messages) {
    if (msg.role === "user" && "content" in msg && msg.content !== null) {
      msg.content = stripFridgeMagnets(msg.content);
    }
  }
}
