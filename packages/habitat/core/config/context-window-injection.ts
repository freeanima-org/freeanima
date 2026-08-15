export type CatalogContextWindowLookup = (model: string) => Promise<number | null>;

let lookup: CatalogContextWindowLookup | null = null;

/** Composition root wires Provider catalog lookup for compression */
export function registerCatalogContextWindowLookup(fn: CatalogContextWindowLookup): void {
  lookup = fn;
}

export function resetCatalogContextWindowLookupForTest(): void {
  lookup = null;
}

/** Optional async Provider catalog fallback; returns null when not registered */
export async function lookupCatalogContextWindow(model: string): Promise<number | null> {
  if (!lookup) return null;
  const trimmed = model.trim();
  if (!trimmed) return null;
  try {
    const window = await lookup(trimmed);
    if (window != null && window > 0) return window;
  } catch {
    return null;
  }
  return null;
}
