export type ComposerTriggerKind = "container" | "tag" | "priority" | "dateSlash";

export type ComposerTrigger = {
  kind: ComposerTriggerKind;
  /** 触发符在全文中的起始下标 */
  start: number;
  /** 触发符之后、光标之前的查询串 */
  query: string;
};

function parseCharTrigger(
  text: string,
  cursorPos: number,
  char: string,
  kind: ComposerTriggerKind,
  allowSpaces: boolean,
): ComposerTrigger | null {
  const end = Math.max(0, Math.min(cursorPos, text.length));
  const before = text.slice(0, end);
  const idx = before.lastIndexOf(char);
  if (idx < 0) return null;
  if (idx > 0) {
    const prev = before[idx - 1];
    if (prev != null && !/\s/.test(prev)) return null;
  }
  const after = before.slice(idx + 1);
  if (after.includes("\n")) return null;
  if (!allowSpaces && /\s/.test(after)) return null;
  return { kind, start: idx, query: after };
}

/** `/` 日期快捷：允许 query 含空格（next week） */
export function parseSlashDateTrigger(text: string, cursorPos: number): ComposerTrigger | null {
  return parseCharTrigger(text, cursorPos, "/", "dateSlash", true);
}

export function parseContainerTrigger(text: string, cursorPos: number): ComposerTrigger | null {
  return parseCharTrigger(text, cursorPos, "@", "container", false);
}

export function parseTagTrigger(text: string, cursorPos: number): ComposerTrigger | null {
  return parseCharTrigger(text, cursorPos, "#", "tag", false);
}

export function parsePriorityTrigger(text: string, cursorPos: number): ComposerTrigger | null {
  return parseCharTrigger(text, cursorPos, "!", "priority", false);
}

/** 取光标前最近一个未完成的触发段 */
export function parseActiveComposerTrigger(
  text: string,
  cursorPos: number,
): ComposerTrigger | null {
  const candidates = [
    parseContainerTrigger(text, cursorPos),
    parseTagTrigger(text, cursorPos),
    parsePriorityTrigger(text, cursorPos),
    parseSlashDateTrigger(text, cursorPos),
  ].filter((c): c is ComposerTrigger => c != null);
  if (candidates.length === 0) return null;
  return candidates.toSorted((a, b) => b.start - a.start)[0] ?? null;
}

export function removeTriggerSegment(
  text: string,
  triggerStart: number,
  cursorPos: number,
): { next: string; caret: number } {
  const start = Math.max(0, Math.min(triggerStart, text.length));
  const end = Math.max(start, Math.min(cursorPos, text.length));
  const next = `${text.slice(0, start)}${text.slice(end)}`;
  const trimmed = next.replace(/\s+/g, " ");
  const leadingTrim = next.length - next.trimStart().length;
  return { next: trimmed.trim(), caret: Math.max(0, start - leadingTrim) };
}
