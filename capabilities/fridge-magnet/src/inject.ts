import type { FridgeMagnet } from "./types.ts";

const FRIDGE_BLOCK_RE = /^```fridge\n[\s\S]*?\n```\n?/;

/** 格式化冰箱贴列表为 Markdown 代码块 */
export function formatFridgeMagnets(magnets: FridgeMagnet[]): string {
  const lines = magnets.map((m) => `${m.key}: ${m.value}`);
  return "```fridge\n" + lines.join("\n") + "\n```\n";
}

/** 在消息内容前面注入冰箱贴块 */
export function injectFridgeMagnets(content: string, magnets: FridgeMagnet[]): string {
  return formatFridgeMagnets(magnets) + content;
}

/** 从消息内容前面剪除冰箱贴块（幂等） */
export function stripFridgeMagnets(content: string): string {
  return content.replace(FRIDGE_BLOCK_RE, "");
}

/** 找到最后一条 user 消息并注入冰箱贴 */
export function injectIntoMessages(
  messages: { role: string; content: string | null }[],
  magnets: FridgeMagnet[],
): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") {
      const msg = messages[i]!;
      msg.content = injectFridgeMagnets(msg.content ?? "", magnets);
      return;
    }
  }
}

/** 剪除所有 user 消息中的冰箱贴块 */
export function stripAllFromMessages(messages: { role: string; content: string | null }[]): void {
  for (const msg of messages) {
    if (msg.role === "user" && msg.content !== null) {
      msg.content = stripFridgeMagnets(msg.content);
    }
  }
}
