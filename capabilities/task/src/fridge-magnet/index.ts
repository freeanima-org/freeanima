export {
  registerFridgeStore,
  getFridgeStore,
  resetFridgeStoreForTests,
  type FridgeStorePort,
} from "./fridge-store-port.ts";
export {
  FRIDGE_MAGNET_KEY_PREFIX,
  FRIDGE_MAGNET_SCAN_PATTERN,
  magnetRedisKey,
  stripMagnetRedisKeyPrefix,
  randomBase62,
  clampTtl,
  setMagnet,
  getMagnet,
  deleteMagnet,
  scanMagnets,
} from "./store.ts";
export {
  FRIDGE_CONTEXT_ASSISTANT_NAME,
  FRIDGE_MAGNET_FENCE,
  FRIDGE_MAGNET_BOARD_HEADING,
  FRIDGE_MAGNET_BOARD_FRAME,
  formatFridgeMagnets,
  wrapFridgeMagnetBoard,
  formatFridgeMagnetManifestPreview,
  isFridgeContextAssistant,
  stripFridgeContextFromMessages,
  manifestFridgeMagnetBoard,
} from "./inject.ts";
export { registerWriteFridgeMagnetTool } from "./tool.ts";
export { createFridgeMagnetHandler } from "./handler.ts";
export type { FridgeMagnet, FridgeMagnetScanHit } from "./types.ts";
