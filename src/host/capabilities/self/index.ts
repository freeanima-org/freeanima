/** Self layer six blocks; see docs/cognition/self-layer.md */
export const CAPABILITIES_IDENTITY_PACKAGE = "@freeanima/capabilities-identity" as const;

export {
  SELF_BLOCK_HEADINGS,
  SELF_BLOCK_EMPTY_PLACEHOLDER,
  SELF_LAYER_SYSTEM_FRAME,
  SELF_LAYER_PROMPT_HEADING,
} from "./blocks.ts";
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
export { registerSelfTools } from "./tools.ts";
