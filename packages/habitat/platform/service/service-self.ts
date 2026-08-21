import { SELF_BLOCK_KEYS } from "@freeanima/habitat/core/db/pg/self-layer/types";
import { toSelfBlockView } from "@freeanima/habitat/capabilities/self";
import type { SelfBlockDisplay } from "@freeanima/features/habitat/protocol/habitat-contract/self-block-display.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { listSelfBlocks as listPgSelfBlocks } from "@freeanima/habitat/core/db/pg/self-layer";

export type { SelfBlockDisplay };

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

/** Habitat self-layer five blocks read-only display（须显式 agent_subject_id） */
export async function listSelfBlocks(
  _deps: RuntimeDeps,
  agentSubjectId: number,
): Promise<{ blocks: SelfBlockDisplay[] }> {
  if (agentSubjectId == null || agentSubjectId <= 0) {
    throw new Error("agent_subject_id is required for self-layer display");
  }
  const id = agentSubjectId;
  try {
    const rows = await listPgSelfBlocks(id);
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
