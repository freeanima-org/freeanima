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
import { loadSoul } from "./soul.ts";

function fallbackBlocksFromSoul(): SelfBlockRow[] {
  const soul = loadSoul();
  const now = "";
  return SELF_BLOCK_KEYS.map((key) => ({
    block_key: key,
    content: key === "self_model" ? soul : "",
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
    return fallbackBlocksFromSoul().map(toSelfBlockView);
  }
}

/** 从 store 组装六块常驻 Markdown；PG 无内容时 fallback SOUL.md */
export async function loadSelfLayerPrompt(): Promise<string> {
  const cached = getSelfLayerPromptCache();
  if (cached) return cached;

  try {
    const rows = await getSelfLayerStore().listBlocks();
    const hasContent = rows.some((row) => row.content.trim().length > 0);
    const inner = hasContent
      ? renderSelfLayerPrompt(rows)
      : renderSelfLayerPrompt(fallbackBlocksFromSoul());
    const prompt = wrapSelfLayerForSystemPrompt(inner);
    setSelfLayerPromptCache(prompt);
    return prompt;
  } catch {
    const prompt = wrapSelfLayerForSystemPrompt(renderSelfLayerPrompt(fallbackBlocksFromSoul()));
    setSelfLayerPromptCache(prompt);
    return prompt;
  }
}

/** self 块更新后刷新缓存 */
export function refreshSelfLayerPromptCache(prompt: string): void {
  setSelfLayerPromptCache(prompt);
}

export { invalidateSelfLayerPromptCache };
