/** 输入框 `[[` 实体引用触发解析 */

export type AnimaMentionTrigger = {
  /** `[[` 在全文中的起始下标 */
  start: number;
  /** `[[` 之后、光标之前的查询串（可为空） */
  query: string;
};

/**
 * 光标前最近未闭合的 `[[…` 触发实体选择器。
 * 已闭合的 `[[anima:1]]` 不触发；`/` slash 菜单优先时由调用方短路。
 */
export function parseAnimaMentionTrigger(
  text: string,
  cursorPos: number,
): AnimaMentionTrigger | null {
  const before = text.slice(0, Math.max(0, Math.min(cursorPos, text.length)));
  const open = before.lastIndexOf("[[");
  if (open < 0) return null;
  const afterOpen = before.slice(open + 2);
  if (afterOpen.includes("]]")) return null;
  // 避免跨行误触发（多行输入时只认当前行）
  if (afterOpen.includes("\n")) return null;
  return { start: open, query: afterOpen };
}

export type AnimaMentionMenuEntry = {
  id: number;
  /** 插入正文，含闭合 `]]` 与尾随空格 */
  insertText: string;
  label: string;
  description?: string;
};

export function buildAnimaMentionInsert(id: number): string {
  return `[[anima:${id}]] `;
}

export function applyAnimaMentionInsert(
  text: string,
  triggerStart: number,
  cursorPos: number,
  insertText: string,
): { next: string; caret: number } {
  const start = Math.max(0, Math.min(triggerStart, text.length));
  const end = Math.max(start, Math.min(cursorPos, text.length));
  const next = `${text.slice(0, start)}${insertText}${text.slice(end)}`;
  return { next, caret: start + insertText.length };
}
