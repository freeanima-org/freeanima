/** Self layer five blocks; see docs/cognition/self-layer.md */
export const CAPABILITIES_IDENTITY_PACKAGE = "@freeanima/capabilities-identity" as const;

export {
  SELF_BLOCK_HEADINGS,
  SELF_BLOCK_EMPTY_PLACEHOLDER,
  SELF_LAYER_SYSTEM_FRAME,
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
  loadSelfLayerInner,
  loadSelfBlocks,
  refreshSelfLayerPromptCache,
  invalidateSelfLayerPromptCache,
} from "./load.ts";
export { getSelfLayerPromptCache, setSelfLayerPromptCache } from "./cache.ts";
export { registerSelfTools } from "./tools.ts";
export {
  registerSelfLayerRefreshEngine,
  resetSelfLayerRefreshEngineForTests,
  runSelfLayerRefreshEngine,
} from "./refresh-engine-port.ts";
export {
  runSelfLayerRefresh,
  runSelfLayerRefreshAllAgents,
  type SelfLayerRefreshResult,
} from "./refresh/run.ts";
export {
  SELF_LAYER_PROPOSAL_SOURCE_REF,
  SELF_LAYER_PROPOSAL_TITLE,
  parseSelfLayerRefreshResponse,
} from "./refresh/messages.ts";
