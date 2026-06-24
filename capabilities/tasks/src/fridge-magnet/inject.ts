import type { AssistantMessage, StoredMessage } from "@freeanima/core/db/domain";
import type { FridgeMagnet } from "./types.ts";

/** OpenAI name field: ^[a-zA-Z0-9_-]{1,64}$ */
export const FRIDGE_CONTEXT_ASSISTANT_NAME = "fridge_context";

export const FRIDGE_MAGNET_FENCE = "fridge-magnet";

export const FRIDGE_MAGNET_BOARD_HEADING = "## Fridge magnets";

export const FRIDGE_MAGNET_BOARD_FRAME =
  "Below are cross-turn sticky notes you wrote for yourself on the fridge board.\n" +
  "They are NOT from the user; treat them as your own working memory.";

const FRIDGE_BLOCK_RE = /^```(?:fridge-magnet|fridge)\n[\s\S]*?\n```\n?/;

/** Format fridge magnet list as Markdown code block */
export function formatFridgeMagnets(magnets: FridgeMagnet[]): string {
  const lines = magnets.filter((m) => m.value.trim().length > 0).map((m) => `${m.key}: ${m.value}`);
  if (lines.length === 0) return "";
  return "```" + FRIDGE_MAGNET_FENCE + "\n" + lines.join("\n") + "\n```\n";
}

/** Consciousness-layer board body: attribution frame + heading + fence */
export function wrapFridgeMagnetBoard(magnets: FridgeMagnet[]): string {
  const fence = formatFridgeMagnets(magnets);
  if (!fence) return "";
  return `${FRIDGE_MAGNET_BOARD_FRAME}\n\n${FRIDGE_MAGNET_BOARD_HEADING}\n${fence}`;
}

/** WebUI preview of the manifest assistant message */
export function formatFridgeMagnetManifestPreview(magnets: FridgeMagnet[]): string {
  const content = wrapFridgeMagnetBoard(magnets);
  if (!content) return "";
  return `role: assistant\nname: ${FRIDGE_CONTEXT_ASSISTANT_NAME}\n\n${content}`;
}

export function isFridgeContextAssistant(msg: StoredMessage): msg is AssistantMessage {
  return msg.role === "assistant" && msg.name === FRIDGE_CONTEXT_ASSISTANT_NAME;
}

/** Remove runtime manifest assistant messages (idempotent) */
export function stripFridgeContextFromMessages(messages: StoredMessage[]): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isFridgeContextAssistant(messages[i]!)) {
      messages.splice(i, 1);
    }
  }
}

/** Strip legacy user-message prepend blocks (migration) */
export function stripFridgeMagnets(content: string): string {
  return content.replace(FRIDGE_BLOCK_RE, "");
}

/** 从 user 消息中剥离旧版 prepend 冰箱贴块（数据迁移） */
export function stripLegacyFridgeBlocksFromMessages(messages: StoredMessage[]): void {
  for (const msg of messages) {
    if (msg.role === "user" && "content" in msg && msg.content !== null) {
      msg.content = stripFridgeMagnets(msg.content);
    }
  }
}

/**
 * Manifest fridge board as assistant(name=fridge_context) immediately before the last user message.
 * No-op unless the last message is user and magnets are non-empty.
 */
export function manifestFridgeMagnetBoard(
  messages: StoredMessage[],
  magnets: FridgeMagnet[],
): void {
  const lastIdx = messages.length - 1;
  const lastMsg = messages[lastIdx];
  if (!lastMsg || lastMsg.role !== "user") return;

  const content = wrapFridgeMagnetBoard(magnets);
  if (!content.trim()) return;

  const manifest: AssistantMessage = {
    role: "assistant",
    name: FRIDGE_CONTEXT_ASSISTANT_NAME,
    content,
  };
  messages.splice(lastIdx, 0, manifest);
}
