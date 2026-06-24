import type { SelfBlockKey } from "@freeanima/core/repos";
import { SELF_BLOCK_KEYS } from "@freeanima/core/repos";
import { toSelfBlockView } from "@freeanima/capabilities-identity";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type SelfBlockDisplay = {
  block_key: SelfBlockKey;
  heading: string;
  content: string;
  locked: boolean;
  version: number;
  updated_by: string | null;
  created: string;
  updated: string;
};

function emptyPlaceholderBlocks(): SelfBlockDisplay[] {
  return SELF_BLOCK_KEYS.map((key) => ({
    block_key: key,
    heading: toSelfBlockView({
      block_key: key,
      content: "",
      locked: key === "existence_anchor",
      version: 0,
      updated_by: null,
      created: "",
      updated: "",
    }).heading,
    content: "",
    locked: key === "existence_anchor",
    version: 0,
    updated_by: null,
    created: "",
    updated: "",
  }));
}

/** Admin self-layer six blocks read-only display */
export async function listSelfBlocks(deps: RuntimeDeps): Promise<{ blocks: SelfBlockDisplay[] }> {
  try {
    const rows = await deps.engine.repos.selfLayer.listBlocks();
    const blocks = rows.map((row) => {
      const view = toSelfBlockView(row);
      return {
        block_key: view.block_key,
        heading: view.heading,
        content: view.content,
        locked: view.locked,
        version: view.version,
        updated_by: row.updated_by,
        created: row.created,
        updated: row.updated,
      };
    });
    return { blocks };
  } catch {
    return { blocks: emptyPlaceholderBlocks() };
  }
}
