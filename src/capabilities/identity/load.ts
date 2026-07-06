import type { SelfBlockRow } from "@freeanima/core/repos";
import { SELF_BLOCK_KEYS } from "@freeanima/core/repos";
import { listSelfBlocks } from "@freeanima/core/db/pg/self-layer";

import {
  getSelfLayerPromptCache,
  invalidateSelfLayerPromptCache,
  setSelfLayerPromptCache,
} from "./cache.ts";
import {
  renderSelfLayerPrompt,
  toSelfBlockView,
  wrapSelfLayerForSystemPrompt,
  type SelfBlockView,
} from "./compose.ts";

function emptyPlaceholderBlocks(): SelfBlockRow[] {
  const now = new Date(0);
  return SELF_BLOCK_KEYS.map((key) => ({
    block_key: key,
    content: "",
    locked: key === "existence_anchor",
    version: 0,
    updated_by: null,
    created_at: now,
    updated_at: now,
  }));
}

/** Load the six self blocks as structured views */
export async function loadSelfBlocks(): Promise<SelfBlockView[]> {
  try {
    const rows = await listSelfBlocks();
    return rows.map(toSelfBlockView);
  } catch {
    return emptyPlaceholderBlocks().map(toSelfBlockView);
  }
}

/** Assemble self-layer system prompt segment from PG self_blocks */
export async function loadSelfLayerPrompt(): Promise<string> {
  const cached = getSelfLayerPromptCache();
  if (cached) return cached;

  try {
    const rows = await listSelfBlocks();
    const prompt = wrapSelfLayerForSystemPrompt(renderSelfLayerPrompt(rows));
    setSelfLayerPromptCache(prompt);
    return prompt;
  } catch {
    const prompt = wrapSelfLayerForSystemPrompt(renderSelfLayerPrompt(emptyPlaceholderBlocks()));
    setSelfLayerPromptCache(prompt);
    return prompt;
  }
}

/** Refresh cache after self block updates */
export function refreshSelfLayerPromptCache(prompt: string): void {
  setSelfLayerPromptCache(prompt);
}

export { invalidateSelfLayerPromptCache };
