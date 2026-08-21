import { rrfMerge } from "@freeanima/habitat/core/util";

import type { SearchChannel, SearchHit } from "./types.ts";

/** Fuse per-channel ranked lists with RRF; preserves channel attribution on hits. */
export function fuseSearchHits(
  byChannel: Partial<Record<SearchChannel, SearchHit[]>>,
  opts?: { limit?: number; fuse?: "rrf" | "none" },
): SearchHit[] {
  const fuse = opts?.fuse ?? "rrf";
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.keys 擦除 keyof
  const channels = Object.keys(byChannel) as SearchChannel[];
  const lists = channels
    .map((ch) => byChannel[ch])
    .filter((list): list is SearchHit[] => Array.isArray(list) && list.length > 0);

  if (lists.length === 0) return [];

  if (fuse === "none" || lists.length === 1) {
    const only = lists[0] ?? [];
    return opts?.limit ? only.slice(0, opts.limit) : only;
  }

  const ranked = lists.map((list) =>
    list.map((h) => ({
      ...h,
      docKey: h.doc_key,
    })),
  );

  const limit = opts?.limit;
  const merged = rrfMerge(ranked, limit == null ? undefined : { limit });
  return merged.map(({ docKey: _dk, score, ...rest }) => {
    const channels_hit = new Set<SearchChannel>();
    const channel_scores: Partial<Record<SearchChannel, number>> = {};
    for (const ch of channels) {
      const list = byChannel[ch];
      if (!list) continue;
      const found = list.find((h) => h.doc_key === rest.doc_key);
      if (found) {
        channels_hit.add(ch);
        channel_scores[ch] = found.score;
      }
    }
    return {
      ...rest,
      score,
      channels_hit: [...channels_hit],
      channel_scores,
    } satisfies SearchHit;
  });
}
