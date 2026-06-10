/** pgvector literal: `[1,2,3]` */
export function formatPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
