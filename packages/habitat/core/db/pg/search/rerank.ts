import type { SearchHit, SearchReranker } from "./types.ts";

/** Pass-through reranker (stage ③ disabled). */
export const identityReranker: SearchReranker = {
  rerank({ hits, top_k }) {
    if (top_k == null) return hits;
    return hits.slice(0, Math.max(0, top_k));
  },
};

export async function applyRerank(
  reranker: SearchReranker,
  input: { text: string; hits: SearchHit[]; top_k?: number },
): Promise<SearchHit[]> {
  return await reranker.rerank(input);
}
