import type { SelfBlockRow } from "@freeanima/storage-repos";
import {
  normalizePgTimestamp,
  selfBlockKeySchema,
  type SelfBlockKey,
} from "@freeanima/storage-db/schema";

export type SelfBlockDbRow = {
  block_key?: string;
  blockKey?: string;
  content: string;
  locked: boolean;
  version: number;
  updated_by?: string | null;
  updatedBy?: string | null;
  created_at?: Date | string;
  createdAt?: Date | string;
  updated_at?: Date | string;
  updatedAt?: Date | string;
};

export function normalizeSelfBlockKey(raw: string): SelfBlockKey {
  const parsed = selfBlockKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw new Error(`invalid self block key: ${raw}`);
  }
  return parsed.data;
}

export function mapSelfBlockRow(row: SelfBlockDbRow): SelfBlockRow {
  const blockKey = normalizeSelfBlockKey(row.block_key ?? row.blockKey ?? "");
  const created = row.created_at ?? row.createdAt;
  const updated = row.updated_at ?? row.updatedAt;
  return {
    block_key: blockKey,
    content: row.content,
    locked: row.locked,
    version: row.version,
    updated_by: row.updated_by ?? row.updatedBy ?? null,
    created: created != null ? normalizePgTimestamp(created) : "",
    updated: updated != null ? normalizePgTimestamp(updated) : "",
  };
}
