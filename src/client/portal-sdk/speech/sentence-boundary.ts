/** 流式自动朗读句界（任务约定，不含英文 `.!?`） */
const SENTENCE_BOUNDARY = /[。！？\n]/;

/**
 * 从 `fromIndex` 起取出已完整的句子，返回句子列表与新的消费游标。
 * 游标指向 raw 文本下标；不完整尾句留在缓冲中。
 */
export function extractCompletedSentences(
  text: string,
  fromIndex: number,
): { sentences: string[]; nextIndex: number } {
  const start = Math.max(0, Math.min(fromIndex, text.length));
  const sentences: string[] = [];
  let cursor = start;

  while (cursor < text.length) {
    const slice = text.slice(cursor);
    const match = SENTENCE_BOUNDARY.exec(slice);
    if (!match || match.index == null) break;

    const end = cursor + match.index + match[0].length;
    const raw = text.slice(cursor, end);
    const body = raw.replace(/[。！？\n]+$/u, "").trim();
    if (body) sentences.push(raw.trim());
    cursor = end;
  }

  return { sentences, nextIndex: cursor };
}

/** 取出 `fromIndex` 之后尚未成句的剩余文本（用于流结束 flush）。 */
export function extractRemainder(text: string, fromIndex: number): string {
  const start = Math.max(0, Math.min(fromIndex, text.length));
  return text.slice(start).trim();
}
