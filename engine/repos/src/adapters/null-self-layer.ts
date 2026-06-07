import type { SelfBlockKey } from "@freeanima/engine-db/schema";

import type { SelfBlockRow, SelfLayerStorePort } from "../ports/self-layer.ts";
import { SELF_BLOCK_KEYS } from "../ports/self-layer.ts";

const unavailable = (): never => {
  throw new Error("database.url 未配置");
};

function emptyBlock(key: SelfBlockKey): SelfBlockRow {
  return {
    block_key: key,
    content: "",
    locked: key === "existence_anchor",
    version: 0,
    updated_by: null,
    created: "",
    updated: "",
  };
}

/** PG 不可用时的自我层端口空实现 */
export const nullSelfLayerStore: SelfLayerStorePort = {
  async getBlock(key) {
    return emptyBlock(key);
  },
  async listBlocks() {
    return SELF_BLOCK_KEYS.map(emptyBlock);
  },
  async upsertBlock() {
    return unavailable();
  },
  async updateBlock() {
    return unavailable();
  },
  async isInitialized() {
    return false;
  },
};
