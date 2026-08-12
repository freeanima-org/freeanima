import type { SelfBlockRow } from "@freeanima/host/core/db/schema/rows";
import { SELF_BLOCK_KEYS } from "@freeanima/host/core/db/pg/self-layer/types";
import { listSelfBlocks } from "@freeanima/host/core/db/pg/self-layer";

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

/** Load the five self blocks as structured views */
export async function loadSelfBlocks(): Promise<SelfBlockView[]> {
  try {
    const rows = await listSelfBlocks();
    return rows.map(toSelfBlockView);
  } catch {
    return emptyPlaceholderBlocks().map(toSelfBlockView);
  }
}

/**
 * Nested self-block XML only (`<existence_anchor>…</existence_anchor>` …).
 * systemPromptBuild folds this with outer `<self_layer>` + frame.
 */
export async function loadSelfLayerInner(): Promise<string> {
  const cached = getSelfLayerPromptCache();
  if (cached) return cached;

  try {
    const rows = await listSelfBlocks();
    const inner = renderSelfLayerPrompt(rows);
    setSelfLayerPromptCache(inner);
    return inner;
  } catch {
    const inner = renderSelfLayerPrompt(emptyPlaceholderBlocks());
    setSelfLayerPromptCache(inner);
    return inner;
  }
}

/** Full self-layer segment (frame + `<self_layer>` + nested blocks) for non-fold consumers */
export async function loadSelfLayerPrompt(): Promise<string> {
  return wrapSelfLayerForSystemPrompt(await loadSelfLayerInner());
}

/** Refresh cache after self block updates */
export function refreshSelfLayerPromptCache(prompt: string): void {
  setSelfLayerPromptCache(prompt);
}

export { invalidateSelfLayerPromptCache };
