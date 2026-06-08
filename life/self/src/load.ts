import type { SelfBlockRow } from "@freeanima/engine-repos";
import { SELF_BLOCK_KEYS } from "@freeanima/engine-repos";

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
import { getSelfLayerStore } from "./port.ts";

function emptyPlaceholderBlocks(): SelfBlockRow[] {
  const now = "";
  return SELF_BLOCK_KEYS.map((key) => ({
    block_key: key,
    content: "",
    locked: key === "existence_anchor",
    version: 0,
    updated_by: null,
    created: now,
    updated: now,
  }));
}

/** 结构化读取六块 */
export async function loadSelfBlocks(): Promise<SelfBlockView[]> {
  try {
    const rows = await getSelfLayerStore().listBlocks();
    return rows.map(toSelfBlockView);
  } catch {
    return emptyPlaceholderBlocks().map(toSelfBlockView);
  }
}

/** 从 PG self_blocks 组装自我层 system prompt 段 */
export async function loadSelfLayerPrompt(): Promise<string> {
  const cached = getSelfLayerPromptCache();
  if (cached) return cached;

  try {
    const rows = await getSelfLayerStore().listBlocks();
    const prompt = wrapSelfLayerForSystemPrompt(renderSelfLayerPrompt(rows));
    setSelfLayerPromptCache(prompt);
    return prompt;
  } catch {
    const prompt = wrapSelfLayerForSystemPrompt(renderSelfLayerPrompt(emptyPlaceholderBlocks()));
    setSelfLayerPromptCache(prompt);
    return prompt;
  }
}

/** self 块更新后刷新缓存 */
export function refreshSelfLayerPromptCache(prompt: string): void {
  setSelfLayerPromptCache(prompt);
}

export { invalidateSelfLayerPromptCache };
