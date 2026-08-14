/** pgvector literal: `[1,2,3]` */
export function formatPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/** Parse pgvector / driver return value into number[]. */
export function parsePgVector(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const out: number[] = [];
    for (const v of raw) {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return null;
      out.push(n);
    }
    return out.length > 0 ? out : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
    const parts = trimmed.slice(1, -1).split(",");
    const out: number[] = [];
    for (const part of parts) {
      const n = Number(part.trim());
      if (!Number.isFinite(n)) return null;
      out.push(n);
    }
    return out.length > 0 ? out : null;
  }
  return null;
}
