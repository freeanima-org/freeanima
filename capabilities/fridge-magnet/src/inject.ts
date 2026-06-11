import type { SessionMessage } from "@freeanima/engine-db/domain";
import type { FridgeMagnet } from "./types.ts";

const FRIDGE_BLOCK_RE = /^```fridge\n[\s\S]*?\n```\n?/;

/** Format fridge magnet list as Markdown code block */
export function formatFridgeMagnets(magnets: FridgeMagnet[]): string {
  const lines = magnets.map((m) => `${m.key}: ${m.value}`);
  return "```fridge\n" + lines.join("\n") + "\n```\n";
}

/** Inject fridge magnet block before message content */
export function injectFridgeMagnets(content: string, magnets: FridgeMagnet[]): string {
  return formatFridgeMagnets(magnets) + content;
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
