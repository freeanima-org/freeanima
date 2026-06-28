import { selfBlocks, normalizePgTimestamp } from "@freeanima/core/db/schema";
import { selfBlockRowSchema, type SelfBlockRow } from "@freeanima/core/repos";

export type SelfBlockDbRow = typeof selfBlocks.$inferSelect;

export function mapSelfBlockRow(row: SelfBlockDbRow): SelfBlockRow {
  return selfBlockRowSchema.parse({
    block_key: row.block_key,
    content: row.content,
    locked: row.locked,
    version: row.version,
    updated_by: row.updated_by ?? null,
    created_at: normalizePgTimestamp(row.created_at),
    updated_at: normalizePgTimestamp(row.updated_at),
  });
}

export { normalizeSelfBlockKey } from "./self-block-key.ts";
