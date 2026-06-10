export type ChunkTextOptions = {
  /** Trim before split; empty string returns [] */
  trimInput?: boolean;
  /** Hard max per segment (defaults to limit) */
  maxChunkLength?: number;
};

/** Split long text into segments (prefer paragraph/newline/space boundaries) */
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
