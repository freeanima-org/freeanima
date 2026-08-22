/** 群聊 / 会话输入框 `@` 成员补全（交互对齐 slash）。 */

export type AtMentionCandidate = {
  /** 稳定 key，如 public_id */
  key: string;
  /** 菜单主列 */
  label: string;
  /** 选中后插入正文（建议含尾随空格） */
  insertText: string;
  description?: string;
};

export type AtMentionTrigger = {
  /** `@` 在全文中的起始下标 */
  start: number;
  /** `@` 之后、光标之前的查询串（可为空） */
  query: string;
};

export type AtMentionMenuEntry = {
  key: string;
  label: string;
  insertText: string;
  description?: string;
};

/**
 * 光标前最近未完成的 `@…` 触发成员选择器。
 * 要求 `@` 位于行首或空白之后；已写完空格则不触发。
 */
export function parseAtMentionTrigger(text: string, cursorPos: number): AtMentionTrigger | null {
  const end = Math.max(0, Math.min(cursorPos, text.length));
  const before = text.slice(0, end);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0) {
    const prev = before[at - 1];
    if (prev != null && !/\s/.test(prev)) return null;
  }
  const after = before.slice(at + 1);
  if (after.includes("\n") || /\s/.test(after)) return null;
  return { start: at, query: after };
}

export function buildAtMentionMenuEntries(
  query: string,
  candidates: AtMentionCandidate[],
): AtMentionMenuEntry[] {
  const q = query.trim().toLowerCase();
  return candidates
    .filter((c) => {
      if (!q) return true;
      return (
        c.label.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q) ||
        c.insertText.toLowerCase().includes(q)
      );
    })
    .map((c) => ({
      key: c.key,
      label: c.label,
      insertText: c.insertText.endsWith(" ") ? c.insertText : `${c.insertText} `,
      ...(c.description ? { description: c.description } : {}),
    }));
}

export function applyAtMentionInsert(
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
