export type FridgeMagnet = {
  /** 展示用 label（通常为 Redis key 去掉 `fridge:` 前缀） */
  key: string;
  value: string;
};

export type FridgeMagnetScanHit = {
  /** 完整 Redis key，如 fridge:session:abc:r1a2 */
  key: string;
  value: string;
};
