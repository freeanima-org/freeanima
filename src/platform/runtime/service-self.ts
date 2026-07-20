import type { SelfBlockKey } from "@freeanima/core/db/pg/self-layer/types";
import { SELF_BLOCK_KEYS } from "@freeanima/core/db/pg/self-layer/types";
import { toSelfBlockView } from "@freeanima/capabilities/identity";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { listSelfBlocks as listPgSelfBlocks } from "@freeanima/core/db/pg/self-layer";

export type SelfBlockDisplay = {
  block_key: SelfBlockKey;
  heading: string;
  content: string;
  locked: boolean;
  version: number;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

const PLACEHOLDER_EPOCH = new Date(0);

function emptyPlaceholderBlocks(): SelfBlockDisplay[] {
  return SELF_BLOCK_KEYS.map((key) => ({
    block_key: key,
    heading: toSelfBlockView({
      block_key: key,
      content: "",
      locked: key === "existence_anchor",
      version: 0,
      updated_by: null,
      created_at: PLACEHOLDER_EPOCH,
      updated_at: PLACEHOLDER_EPOCH,
    }).heading,
    content: "",
    locked: key === "existence_anchor",
    version: 0,
    updated_by: null,
    created_at: PLACEHOLDER_EPOCH,
    updated_at: PLACEHOLDER_EPOCH,
  }));
}

/** Habitat self-layer six blocks read-only display */
export async function listSelfBlocks(_deps: RuntimeDeps): Promise<{ blocks: SelfBlockDisplay[] }> {
  try {
    const rows = await listPgSelfBlocks();
    const blocks = rows.map((row) => {
      const view = toSelfBlockView(row);
      return {
        block_key: view.block_key,
        heading: view.heading,
        content: view.content,
        locked: view.locked,
        version: view.version,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
    return { blocks };
  } catch {
    return { blocks: emptyPlaceholderBlocks() };
  }
}
