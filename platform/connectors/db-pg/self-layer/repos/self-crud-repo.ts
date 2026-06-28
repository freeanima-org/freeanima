import { eq } from "drizzle-orm";
import { selfBlockKeySchema, selfBlocks } from "@freeanima/core/db/schema";
import type {
  SelfBlockKey,
  SelfBlockRow,
  SelfBlockUpdateInput,
  SelfBlockUpsertInput,
} from "@freeanima/core/repos";
import { SELF_BLOCK_KEYS } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";
import { mapSelfBlockRow } from "../mappers/self-mapper.ts";

function normalizeBlockKey(raw: string): SelfBlockKey {
  const parsed = selfBlockKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw new Error(`invalid self block key: ${raw}`);
  }
  return parsed.data;
}

export async function getSelfBlock(key: SelfBlockKey): Promise<SelfBlockRow | null> {
  const db = getDb();
  const rows = await db.select().from(selfBlocks).where(eq(selfBlocks.block_key, key)).limit(1);
  const row = rows[0];
  return row ? mapSelfBlockRow(row) : null;
}

export async function listSelfBlocks(): Promise<SelfBlockRow[]> {
  const db = getDb();
  const rows = await db.select().from(selfBlocks);
  const byKey = new Map(
    rows.map((row) => [normalizeBlockKey(row.block_key), mapSelfBlockRow(row)]),
  );
  const now = formatCstIso();
  return SELF_BLOCK_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    return {
      block_key: key,
      content: "",
      locked: key === "existence_anchor",
      version: 0,
      updated_by: null,
      created_at: now,
      updated_at: now,
    };
  });
}

export async function upsertSelfBlock(input: SelfBlockUpsertInput): Promise<void> {
  const block_key = normalizeBlockKey(input.block_key);
  const now = formatCstIso();
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
      created_at: new Date(now),
      updated_at: new Date(now),
    })
    .onConflictDoUpdate({
      target: selfBlocks.block_key,
      set: {
        content: input.content,
        locked,
        version,
        updated_by: input.updated_by ?? null,
        updated_at: new Date(now),
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

  const now = formatCstIso();
  const patch: Partial<typeof selfBlocks.$inferInsert> = {
    updated_at: new Date(now),
    version: existing.version + 1,
  };
  if (input.content !== undefined) patch.content = input.content;
  if (input.locked !== undefined) patch.locked = input.locked;
  if (input.updated_by !== undefined) patch.updated_by = input.updated_by;

  const db = getDb();
  await db.update(selfBlocks).set(patch).where(eq(selfBlocks.block_key, block_key));
}
