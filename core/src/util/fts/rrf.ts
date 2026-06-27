export type RrfHit = {
  docKey: string;
};

export type RrfScoredHit<T extends RrfHit = RrfHit> = T & { score: number };

/** Reciprocal Rank Fusion: score(d) = Σ 1/(k + rank_i) */
export function rrfMerge<T extends RrfHit>(
  rankedLists: Array<Array<T>>,
  opts?: { k?: number; limit?: number },
): Array<RrfScoredHit<T>> {
  const k = opts?.k ?? 60;
  const limit = opts?.limit;
  const scores = new Map<string, { score: number; hit: T }>();

  for (const list of rankedLists) {
    list.forEach((hit, index) => {
      const rank = index + 1;
      const contribution = 1 / (k + rank);
      const existing = scores.get(hit.docKey);
      if (existing) {
        existing.score += contribution;
      } else {
        scores.set(hit.docKey, { score: contribution, hit });
      }
    });
  }

  const merged = [...scores.values()]
    .toSorted((a, b) => b.score - a.score)
    .map(({ score, hit }) => ({ ...hit, score }));

  return limit ? merged.slice(0, limit) : merged;
}

export function semanticMemoryDocKey(id: string): string {
  return `sm:${id}`;
}

export function messageDocKey(id: string): string {
  return `msg:${id}`;
}

export function limbicDocKey(id: string): string {
  return `lm:${id}`;
}

export function autobiographicalDocKey(id: string): string {
  return `ab:${id}`;
}

export function entityDocKey(id: number): string {
  return `ent:${id}`;
}
