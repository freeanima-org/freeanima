import { eq, notInArray } from "drizzle-orm";
import { selfBlockKeySchema, selfBlocks } from "@freeanima/habitat/core/db/schema";
import type {
  SelfBlockKey,
  SelfBlockRow,
  SelfBlockUpdateInput,
  SelfBlockUpsertInput,
} from "../types.ts";
import { SELF_BLOCK_KEYS } from "../types.ts";

import { getDb } from "../../client.ts";

function normalizeBlockKey(raw: string): SelfBlockKey {
  const parsed = selfBlockKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw new Error(`invalid self block key: ${raw}`);
  }
  return parsed.data;
}

const PLACEHOLDER_EPOCH = new Date(0);

/** Drop legacy keys (e.g. autobiography_summary) left after five-block migration */
export async function purgeOrphanSelfBlocks(): Promise<number> {
  const db = getDb();
  const deleted = await db
    .delete(selfBlocks)
    .where(notInArray(selfBlocks.block_key, [...SELF_BLOCK_KEYS]))
    .returning({ block_key: selfBlocks.block_key });
  return deleted.length;
}

export async function getSelfBlock(key: SelfBlockKey): Promise<SelfBlockRow | null> {
  const db = getDb();
  const rows = await db.select().from(selfBlocks).where(eq(selfBlocks.block_key, key)).limit(1);
  return rows[0] ?? null;
}

export async function listSelfBlocks(): Promise<SelfBlockRow[]> {
  const db = getDb();
  const rows = await db.select().from(selfBlocks);
  const byKey = new Map<SelfBlockKey, SelfBlockRow>();
  for (const row of rows) {
    const parsed = selfBlockKeySchema.safeParse(row.block_key);
    if (!parsed.success) continue;
    byKey.set(parsed.data, { ...row, block_key: parsed.data });
  }
  return SELF_BLOCK_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    return {
      block_key: key,
      content: "",
      locked: key === "existence_anchor",
      version: 0,
      updated_by: null,
      created_at: PLACEHOLDER_EPOCH,
      updated_at: PLACEHOLDER_EPOCH,
    };
  });
}

export async function upsertSelfBlock(input: SelfBlockUpsertInput): Promise<void> {
  const block_key = normalizeBlockKey(input.block_key);
  const now = new Date();
  const locked = input.locked ?? block_key === "existence_anchor";

  const db = getDb();
  const existing = await getSelfBlock(block_key);
  const version = existing ? existing.version + 1 : 1;

  await db
    .insert(selfBlocks)
    .values({
      block_key,
      content: input.content,
      locked,
      version,
      updated_by: input.updated_by ?? null,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: selfBlocks.block_key,
      set: {
        content: input.content,
        locked,
        version,
        updated_by: input.updated_by ?? null,
        updated_at: now,
      },
    });
}

export async function updateSelfBlock(
  input: SelfBlockUpdateInput,
  opts?: { force?: boolean },
): Promise<void> {
  const block_key = normalizeBlockKey(input.block_key);
  const existing = await getSelfBlock(block_key);
  if (!existing) {
    throw new Error(`self block not found: ${block_key}`);
  }
  if (existing.locked && !opts?.force) {
    throw new Error(`self block is locked: ${block_key}`);
  }

  const now = new Date();
  const patch: Partial<typeof selfBlocks.$inferInsert> = {
    updated_at: now,
    version: existing.version + 1,
  };
  if (input.content !== undefined) patch.content = input.content;
  if (input.locked !== undefined) patch.locked = input.locked;
  if (input.updated_by !== undefined) patch.updated_by = input.updated_by;

  const db = getDb();
  await db.update(selfBlocks).set(patch).where(eq(selfBlocks.block_key, block_key));
}
