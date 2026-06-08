/** 自我层六块；详见 docs/self-layer.md */
export const LIFE_SELF_PACKAGE = "@freeanima/life-self" as const;

export { loadSoul } from "./soul.ts";
export {
  SELF_BLOCK_HEADINGS,
  SELF_BLOCK_EMPTY_PLACEHOLDER,
  DEFAULT_EXISTENCE_ANCHOR,
  DEFAULT_METACOGNITION,
  SELF_LAYER_SYSTEM_FRAME,
  SELF_LAYER_PROMPT_HEADING,
} from "./blocks.ts";
export { registerSelfLayerStore, getSelfLayerStore, resetSelfLayerStoreForTests } from "./port.ts";
export {
  renderSelfLayerPrompt,
  wrapSelfLayerForSystemPrompt,
  composeSelfLayerPromptFromViews,
  toSelfBlockView,
  type SelfBlockView,
} from "./compose.ts";
export {
  loadSelfLayerPrompt,
  loadSelfBlocks,
  refreshSelfLayerPromptCache,
  invalidateSelfLayerPromptCache,
} from "./load.ts";
export { getSelfLayerPromptCache, setSelfLayerPromptCache } from "./cache.ts";
export {
  seedSelfLayerFromLegacy,
  ensureSelfLayerSeeded,
  type LegacyPinnedFact,
  type SeedSelfLayerOpts,
} from "./seed.ts";
export { registerSelfTools } from "./tools.ts";
