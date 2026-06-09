import { eq, sql } from "drizzle-orm";
import { selfBlockKeySchema, selfBlocks } from "@freeanima/engine-db/schema";
import type {
  SelfBlockKey,
  SelfBlockRow,
  SelfBlockUpdateInput,
  SelfBlockUpsertInput,
} from "@freeanima/engine-repos";
import { SELF_BLOCK_KEYS } from "@freeanima/engine-repos";
import { formatCstIso } from "@freeanima/kernel-util";

import { getDb } from "../../client.ts";
import { mapSelfBlockRow, type SelfBlockDbRow } from "../mappers/self-mapper.ts";

function normalizeBlockKey(raw: string): SelfBlockKey {
  const parsed = selfBlockKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw new Error(`invalid self block key: ${raw}`);
  }
  return parsed.data;
}

export async function getSelfBlock(key: SelfBlockKey): Promise<SelfBlockRow | null> {
  const db = getDb();
  const rows = await db.execute<SelfBlockDbRow>(sql`
    SELECT block_key, content, locked, version, updated_by, created_at, updated_at
    FROM self_blocks
    WHERE block_key = ${key}
    LIMIT 1
  `);
  const row = rows[0];
  return row ? mapSelfBlockRow(row) : null;
}

export async function listSelfBlocks(): Promise<SelfBlockRow[]> {
  const db = getDb();
  const rows = await db.execute<SelfBlockDbRow>(sql`
    SELECT block_key, content, locked, version, updated_by, created_at, updated_at
    FROM self_blocks
  `);
  const byKey = new Map(
    rows.map((row) => {
      const mapped = mapSelfBlockRow(row);
      return [mapped.block_key, mapped] as const;
    }),
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
      created: now,
      updated: now,
    };
  });
}

export async function upsertSelfBlock(input: SelfBlockUpsertInput): Promise<void> {
  const blockKey = normalizeBlockKey(input.block_key);
  const now = formatCstIso();
  const locked = input.locked ?? blockKey === "existence_anchor";

  const db = getDb();
  const existing = await getSelfBlock(blockKey);
  const version = existing ? existing.version + 1 : 1;

  await db
    .insert(selfBlocks)
    .values({
      blockKey,
      content: input.content,
      locked,
      version,
      updatedBy: input.updated_by ?? null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })
    .onConflictDoUpdate({
      target: selfBlocks.blockKey,
      set: {
        content: input.content,
        locked,
        version,
        updatedBy: input.updated_by ?? null,
        updatedAt: new Date(now),
      },
    });
}

export async function updateSelfBlock(
  input: SelfBlockUpdateInput,
  opts?: { force?: boolean },
): Promise<void> {
  const blockKey = normalizeBlockKey(input.block_key);
  const existing = await getSelfBlock(blockKey);
  if (!existing) {
    throw new Error(`self block not found: ${blockKey}`);
  }
  if (existing.locked && !opts?.force) {
    throw new Error(`self block is locked: ${blockKey}`);
  }

  const now = formatCstIso();
  const patch: Partial<typeof selfBlocks.$inferInsert> = {
    updatedAt: new Date(now),
    version: existing.version + 1,
  };
  if (input.content !== undefined) patch.content = input.content;
  if (input.locked !== undefined) patch.locked = input.locked;
  if (input.updated_by !== undefined) patch.updatedBy = input.updated_by;

  const db = getDb();
  await db.update(selfBlocks).set(patch).where(eq(selfBlocks.blockKey, blockKey));
}
