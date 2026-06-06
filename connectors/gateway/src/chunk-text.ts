export type ChunkTextOptions = {
  /** 切分前先 trim；空串返回 [] */
  trimInput?: boolean;
  /** 单段硬上限（默认同 limit） */
  maxChunkLength?: number;
};

/** 将长文本切为多段（优先段落/换行/空格边界） */
export function chunkText(text: string, limit: number, options?: ChunkTextOptions): string[] {
  const input = options?.trimInput ? text.trim() : text;
  if (options?.trimInput && !input) return [];
  if (input.length <= limit) return [input];

  const maxChunk = options?.maxChunkLength ?? limit;
  const chunks: string[] = [];
  let rest = input;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n\n", limit);
    if (cut < limit / 2) cut = rest.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = rest.lastIndexOf(" ", limit);
    if (cut < limit / 2) cut = limit;
    cut = Math.min(cut, maxChunk);
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks.filter((c) => c.length > 0);
}
